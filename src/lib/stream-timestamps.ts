import { createHash } from "crypto";
import type { LedgerDb } from "./accrual";
import { momentPayload, sendToDiscord } from "./discord-webhook";
import { open } from "./secret-box";
import { parseBannedWords } from "./message-filter";
import { planFeatures } from "./plans";
import { loadGoalProgress } from "./goal-progress";
import {
  buildComment,
  chatReply,
  cleanTitle,
  cleanUser,
  commentLines,
  isVideoId,
  offsetSeconds,
  rupeeLabel,
  videoIdFromChatId,
} from "./timestamps";
import type { YouTubeClient } from "./youtube";

// Stream timestamps, the parts that touch the database and YouTube. Everything outside
// is injected (`Deps`), so tests run it with an in-memory Postgres and a fake YouTube.

export type Deps = {
  yt: YouTubeClient;
  discord: typeof sendToDiscord;
  now: () => Date;
  // Decrypts a stored secret (the real one is secret-box `open`).
  unseal: (sealed: string | null | undefined) => string | null;
};

export const realDeps = (yt: YouTubeClient): Deps => ({ yt, discord: sendToDiscord, now: () => new Date(), unseal: (s) => open(s) });

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const MAX_MOMENTS_PER_STREAM = 500;
export const TOKEN_LIMIT_PER_MINUTE = 30;
export const USER_COOLDOWN_SECONDS = 5;
// A stream that still cannot be commented on this long after it was first seen is dropped.
export const GIVE_UP_HOURS = 48;
export const MAX_ATTEMPTS = 3;

type Row = Record<string, unknown>;

// ---------------------------------------------------------------- chat command

type Creator = {
  id: string;
  creator_status: string;
  paid_features: string[] | null;
  yt_channel_id: string | null;
  ts_delay_seconds: number;
  banned_words: string | null;
  yt_refresh_token_enc: string | null;
  discord_webhook_enc: string | null;
};

// The live video per creator, remembered a few minutes so a busy chat does not spend
// YouTube quota on every command. Per server instance; losing it only costs a call.
const liveCache = new Map<string, { videoId: string | null; until: number }>();
const LIVE_CACHE_MS = 5 * 60 * 1000;
// For tests: creator ids repeat across fresh databases.
export const clearLiveCache = () => liveCache.clear();

// The creator's video that is live right now, asked of YouTube with their own permission
// and remembered a few minutes.
async function liveVideoId(creator: Creator, deps: Deps): Promise<string | null> {
  const now = deps.now().getTime();
  const hit = liveCache.get(creator.id);
  if (hit && hit.until > now) return hit.videoId;
  const refresh = deps.unseal(creator.yt_refresh_token_enc);
  if (!refresh) return null;
  const access = await deps.yt.refreshAccessToken(refresh);
  if (!access.ok) return null;
  const videoId = await deps.yt.activeBroadcast(access.accessToken);
  if (videoId) liveCache.set(creator.id, { videoId, until: now + LIVE_CACHE_MS });
  return videoId;
}

async function resolveVideoId(creator: Creator, chatId: string, deps: Deps): Promise<string | null> {
  return videoIdFromChatId(chatId) ?? (await liveVideoId(creator, deps));
}

type StreamInfo = { creator_id: string; started_at: Date | null; title: string | null; n: number };

// What we know about a stream, asking YouTube once if it is new or its start is unknown,
// and making sure the stream is this creator's own. `error` is a sentence for chat.
async function ensureStream(
  db: LedgerDb,
  deps: Deps,
  creator: Creator,
  videoId: string,
): Promise<{ stream: StreamInfo; error: null } | { stream: null; error: string }> {
  let [stream] = await db<StreamInfo[]>`
    select s.creator_id::text, s.started_at, s.title,
           (select count(*)::int from stream_timestamps m where m.video_id = s.video_id) as n
      from timestamp_streams s where s.video_id = ${videoId}
  `;
  if (stream && stream.creator_id !== creator.id) return { stream: null, error: "This stream belongs to another channel." };
  if (stream && stream.n >= MAX_MOMENTS_PER_STREAM) return { stream: null, error: "This stream has reached its timestamp limit." };

  if (!stream || !stream.started_at) {
    const videos = await deps.yt.getVideos([videoId]);
    const video = videos?.get(videoId);
    if (video) {
      if (creator.yt_channel_id && video.channelId !== creator.yt_channel_id) return { stream: null, error: "This stream belongs to another channel." };
      await db`
        insert into timestamp_streams (video_id, creator_id, title, started_at)
        values (${videoId}, ${creator.id}, ${video.title || null}, ${video.startedAt})
        on conflict (video_id) do update
          set started_at = coalesce(timestamp_streams.started_at, excluded.started_at),
              title      = coalesce(timestamp_streams.title, excluded.title)
        where timestamp_streams.creator_id = excluded.creator_id
      `;
    } else {
      // YouTube did not answer. Save the moment anyway; the posting job checks the
      // stream's owner before it comments.
      await db`
        insert into timestamp_streams (video_id, creator_id) values (${videoId}, ${creator.id})
        on conflict (video_id) do nothing
      `;
    }
    [stream] = await db<StreamInfo[]>`
      select s.creator_id::text, s.started_at, s.title, 0 as n from timestamp_streams s where s.video_id = ${videoId}
    `;
    if (!stream || stream.creator_id !== creator.id) return { stream: null, error: "This stream belongs to another channel." };
  }
  return { stream, error: null };
}

// Returns true when a rate limit allows this key now (and counts the attempt).
async function allow(db: LedgerDb, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const [row] = await db<{ n: number }[]>`
    select count(*)::int as n from ts_rate
     where key_hash = ${key} and created_at > now() - make_interval(secs => ${windowSeconds})
  `;
  if ((row?.n ?? 0) >= limit) return false;
  await db`insert into ts_rate (key_hash) values (${key})`;
  return true;
}

export type MomentInput = { token: string; user: string; message: string; chatId: string };

// Saves one !ts. Always returns text for chat: a problem is a polite sentence, never
// an error, because Nightbot would print an error page in the stream's chat.
export async function recordMoment(db: LedgerDb, deps: Deps, input: MomentInput): Promise<string> {
  if (!TOKEN_PATTERN.test(input.token)) return "This timestamp command is not set up. Make a new one in Freetip.";
  const tokenHash = hashToken(input.token);

  let creator: Creator | undefined;
  try {
    [creator] = await db<Creator[]>`
      select id::text, creator_status, paid_features, yt_channel_id, ts_delay_seconds, banned_words,
             yt_refresh_token_enc, discord_webhook_enc
        from users where ts_token_hash = ${tokenHash}
    `;
  } catch (err) {
    console.error("Timestamps: could not look up the creator (migration 0032 run?).", err);
    return "Timestamps are not working right now. Try again soon.";
  }
  if (!creator || creator.creator_status === "suspended") {
    return "This timestamp command is not set up. Make a new one in Freetip.";
  }
  if (!planFeatures(creator).timestamps) return "Timestamps are not on for this channel.";

  const user = cleanUser(input.user);
  try {
    if (!(await allow(db, tokenHash, TOKEN_LIMIT_PER_MINUTE, 60))) return "Slow down, too many timestamps at once.";
    if (!(await allow(db, hashToken(`${tokenHash}:${user.toLowerCase()}`), 1, USER_COOLDOWN_SECONDS))) {
      return "Wait a few seconds before the next timestamp.";
    }
  } catch (err) {
    console.error("Timestamps: rate limit check failed.", err);
    return "Timestamps are not working right now. Try again soon.";
  }

  try {
    const videoId = await resolveVideoId(creator, input.chatId, deps);
    if (!videoId || !isVideoId(videoId)) return "Could not tell which stream this is. Is it live?";

    const ensured = await ensureStream(db, deps, creator, videoId);
    if (ensured.stream === null) return ensured.error;
    const stream = ensured.stream;

    const title = cleanTitle(input.message, parseBannedWords(creator.banned_words));
    const now = deps.now();
    await db`
      insert into stream_timestamps (creator_id, video_id, chat_user, title, source, delay_seconds, created_at)
      values (${creator.id}, ${videoId}, ${user}, ${title || null}, 'chat', ${creator.ts_delay_seconds}, ${now.toISOString()})
    `;

    const seconds = stream.started_at ? offsetSeconds(now, stream.started_at, creator.ts_delay_seconds) : null;

    // Discord before the reply: work left running after the response is lost on Vercel.
    const webhook = deps.unseal(creator.discord_webhook_enc);
    if (webhook && seconds !== null) {
      const result = await deps.discord(
        webhook,
        momentPayload({ videoId, streamTitle: stream.title, seconds, title, user }),
      );
      if (result !== "sent") console.error(`Timestamps: Discord message ${result} for creator ${creator.id}.`);
    }

    return chatReply(seconds, title);
  } catch (err) {
    console.error("Timestamps: could not save a moment.", err);
    return "Timestamps are not working right now. Try again soon.";
  }
}

// ------------------------------------------------------- automatic moments (phase 2)

export type AutoMarkResult = "saved" | "off" | "not_live" | "duplicate" | "refused" | "error";

type AutoMark = { creatorId: number; source: "tip" | "goal"; label: string; ref: string; at: Date };

// Adds a moment on its own: a big tip or a completed goal, at the second its alert played.
// Needs the creator to have switched automatic moments on (`ts_tip_min_paise` set) and to
// have connected YouTube (that is how we find which stream is live). The label is only the
// amount or the goal's title, never a fan's name, so nothing about a fan reaches YouTube,
// Discord or a public page. Safe to call twice for the same tip or goal.
export async function recordAutoMark(db: LedgerDb, deps: Deps, mark: AutoMark): Promise<AutoMarkResult> {
  try {
    const [creator] = await db<(Creator & { ts_tip_min_paise: number | null })[]>`
      select id::text, creator_status, paid_features, yt_channel_id, ts_delay_seconds, banned_words,
             yt_refresh_token_enc, discord_webhook_enc, ts_tip_min_paise
        from users where id = ${mark.creatorId}
    `;
    if (!creator || creator.creator_status === "suspended" || creator.ts_tip_min_paise === null) return "off";
    if (!planFeatures(creator).tipMarks) return "off";

    const videoId = await liveVideoId(creator, deps);
    if (!videoId || !isVideoId(videoId)) return "not_live";
    const ensured = await ensureStream(db, deps, creator, videoId);
    if (ensured.stream === null) return "refused";
    const stream = ensured.stream;

    const title = cleanTitle(mark.label, parseBannedWords(creator.banned_words)) || mark.label.slice(0, 60);
    const saved = await db<{ id: string }[]>`
      insert into stream_timestamps (creator_id, video_id, chat_user, title, source, delay_seconds, ref, created_at)
      values (${creator.id}, ${videoId}, null, ${title}, ${mark.source}, 0, ${mark.ref}, ${mark.at.toISOString()})
      on conflict (video_id, source, ref) where ref is not null do nothing
      returning id::text
    `;
    if (!saved.length) return "duplicate";

    const webhook = deps.unseal(creator.discord_webhook_enc);
    const seconds = stream.started_at ? offsetSeconds(mark.at, stream.started_at, 0) : null;
    if (webhook && seconds !== null) {
      const result = await deps.discord(
        webhook,
        momentPayload({ videoId, streamTitle: stream.title, seconds, title, user: "Freetip" }),
      );
      if (result !== "sent") console.error(`Timestamps: Discord message ${result} for creator ${creator.id}.`);
    }
    return "saved";
  } catch (err) {
    console.error("Timestamps: could not save an automatic moment (migration 0033 run?).", err);
    return "error";
  }
}

// Called once a live tip's alert has really played on the creator's overlay. Marks the tip
// when it is at or above the creator's threshold, and marks every goal this tip pushed over
// its target. Test-mode money is ignored, like the books do. Never throws.
export async function markTipPlayed(db: LedgerDb, deps: Deps, tipId: number): Promise<void> {
  try {
    const [tip] = await db<{ creator_id: string; gross: string; threshold: number | null; live: boolean }[]>`
      select t.creator_id::text, t.gross_amount_minor::text as gross, u.ts_tip_min_paise as threshold,
             exists (select 1 from payment_attempts pa
                      where pa.tip_order_id = t.id and pa.livemode is true and pa.provider_status = 'captured') as live
        from tip_orders t join users u on u.id = t.creator_id
       where t.id = ${tipId} and t.status = 'captured'
    `;
    // Off for this creator (or a test-mode tip): nothing to do, and no YouTube calls made.
    if (!tip || tip.threshold === null || !tip.live) return;
    const creatorId = Number(tip.creator_id);
    const gross = Number(tip.gross);
    const at = deps.now();

    if (gross >= tip.threshold) {
      await recordAutoMark(db, deps, { creatorId, source: "tip", label: `${rupeeLabel(gross)} tip`, ref: `tip:${tipId}`, at });
    }

    // A goal is reached by the tip that takes the total from under its target to at or over it.
    const goals = await loadGoalProgress(db, creatorId, at);
    for (const g of goals) {
      if (g.raisedPaise >= g.effectiveTargetPaise && g.raisedPaise - gross < g.effectiveTargetPaise) {
        await recordAutoMark(db, deps, {
          creatorId,
          source: "goal",
          label: `Goal reached: ${g.title}`,
          ref: `goal:${g.id}:${g.since}`,
          at,
        });
      }
    }
  } catch (err) {
    console.error("Timestamps: could not mark a played tip (migration 0033 run?).", err);
  }
}

// ----------------------------------------------------------------- posting job

export type RunSummary = { checked: number; posted: number; skipped: number; waiting: number; failed: number };

type QueuedStream = {
  video_id: string;
  creator_id: string;
  state: string;
  started_at: Date | null;
  title: string | null;
  attempts: number;
  age_hours: number;
  yt_channel_id: string | null;
  yt_refresh_token_enc: string | null;
};

async function setState(db: LedgerDb, videoId: string, state: string, reason: string | null, extra: { commentId?: string } = {}) {
  await db`
    update timestamp_streams
       set state = ${state}, reason = ${reason},
           comment_id = coalesce(${extra.commentId ?? null}, comment_id),
           posted_at = case when ${state} = 'posted' then now() else posted_at end
     where video_id = ${videoId}
  `;
}

// Comments each ended stream's moments on it, once. Safe to run as often as wanted: a
// stream still live is left alone, and a stream is claimed before posting so two runs
// can never post the same one.
export async function postDueComments(db: LedgerDb, deps: Deps, budgetMs = 240_000): Promise<RunSummary> {
  const summary: RunSummary = { checked: 0, posted: 0, skipped: 0, waiting: 0, failed: 0 };
  const deadline = Date.now() + budgetMs;

  // A job that died after claiming never knows whether the comment went out, so it is
  // not retried (a retry could post twice).
  await db`
    update timestamp_streams set state = 'failed', reason = 'interrupted'
     where state = 'posting' and claimed_at < now() - interval '1 hour'
  `;

  const queued = await db<QueuedStream[]>`
    select s.video_id, s.creator_id::text, s.state, s.started_at, s.title, s.attempts,
           extract(epoch from (now() - s.created_at)) / 3600 as age_hours,
           u.yt_channel_id, u.yt_refresh_token_enc
      from timestamp_streams s join users u on u.id = s.creator_id
     where s.state = 'queued'
     order by s.created_at
     limit 200
  `;

  for (let i = 0; i < queued.length; i += 50) {
    const batch = queued.slice(i, i + 50);
    const videos = await deps.yt.getVideos(batch.map((s) => s.video_id));
    if (!videos) continue; // YouTube down: nothing is learned about the streams.

    for (const stream of batch) {
      if (Date.now() > deadline) return summary;
      summary.checked += 1;
      const stale = Number(stream.age_hours) > GIVE_UP_HOURS;
      const giveUp = async (reason: string) => {
        if (stale) {
          await setState(db, stream.video_id, "skipped", reason);
          summary.skipped += 1;
        } else {
          summary.waiting += 1;
        }
      };

      const video = videos.get(stream.video_id);
      if (!video) { await giveUp("unavailable"); continue; }
      if (stream.yt_channel_id && video.channelId !== stream.yt_channel_id) {
        await setState(db, stream.video_id, "skipped", "not_owner");
        summary.skipped += 1;
        continue;
      }
      if (video.isLive) { summary.waiting += 1; continue; }
      if (!video.startedAt) {
        await setState(db, stream.video_id, "skipped", "never_live");
        summary.skipped += 1;
        continue;
      }
      if (!video.visible) { await giveUp("unavailable"); continue; }
      if (video.madeForKids) {
        await setState(db, stream.video_id, "skipped", "not_commentable");
        summary.skipped += 1;
        continue;
      }
      await db`
        update timestamp_streams set started_at = ${video.startedAt}, title = coalesce(title, ${video.title || null})
         where video_id = ${stream.video_id}
      `;

      const moments = await db<{ created_at: Date; title: string | null; chat_user: string | null; delay_seconds: number }[]>`
        select created_at, title, chat_user, delay_seconds from stream_timestamps
         where video_id = ${stream.video_id} order by created_at
      `;
      const lines = commentLines(
        moments.map((m) => ({
          seconds: offsetSeconds(m.created_at, video.startedAt as string, m.delay_seconds),
          title: m.title ?? "",
          user: m.chat_user ?? "",
        })),
      );
      const body = buildComment(lines);
      if (!body) {
        await setState(db, stream.video_id, "skipped", "no_timestamps");
        summary.skipped += 1;
        continue;
      }

      const refresh = deps.unseal(stream.yt_refresh_token_enc);
      if (!refresh) {
        await db`update timestamp_streams set reason = 'not_connected' where video_id = ${stream.video_id}`;
        if (stale) {
          await setState(db, stream.video_id, "failed", "not_connected");
          summary.failed += 1;
        } else {
          summary.waiting += 1;
        }
        continue;
      }

      // Claim first, so a second run cannot post it too.
      const claimed = await db<{ video_id: string }[]>`
        update timestamp_streams set state = 'posting', claimed_at = now(), attempts = attempts + 1
         where video_id = ${stream.video_id} and state = 'queued' returning video_id
      `;
      if (!claimed.length) continue;

      const access = await deps.yt.refreshAccessToken(refresh);
      if (!access.ok) {
        if (access.reason === "invalid_grant") {
          await db`update users set yt_refresh_token_enc = null, yt_reconnect_needed = true where id = ${stream.creator_id}`;
          await setState(db, stream.video_id, "queued", "reconnect");
        } else {
          await setState(db, stream.video_id, stream.attempts + 1 >= MAX_ATTEMPTS ? "failed" : "queued", "token");
        }
        summary.waiting += 1;
        continue;
      }

      const result = await deps.yt.postComment(access.accessToken, stream.video_id, body);
      switch (result.outcome) {
        case "posted":
          await setState(db, stream.video_id, "posted", null, { commentId: result.commentId });
          summary.posted += 1;
          break;
        case "rejected":
          await setState(db, stream.video_id, "skipped", result.reason);
          summary.skipped += 1;
          break;
        case "quota":
          await setState(db, stream.video_id, "queued", "quota");
          summary.waiting += 1;
          return summary; // The rest would fail the same way.
        case "unknown":
          await setState(db, stream.video_id, "failed", "unknown");
          summary.failed += 1;
          break;
        default:
          await setState(db, stream.video_id, stream.attempts + 1 >= MAX_ATTEMPTS ? "failed" : "queued", result.reason);
          summary.failed += stream.attempts + 1 >= MAX_ATTEMPTS ? 1 : 0;
          summary.waiting += stream.attempts + 1 >= MAX_ATTEMPTS ? 0 : 1;
      }
    }
  }
  return summary;
}

// Rate-limit rows only matter for a minute; keep an hour.
export async function purgeRateRows(db: LedgerDb): Promise<number> {
  const rows = await db<Row[]>`delete from ts_rate where created_at < now() - interval '1 hour' returning 1`;
  return rows.length;
}
