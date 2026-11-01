import { createHash } from "crypto";
import type { LedgerDb } from "./accrual";
import { momentPayload, sendToDiscord } from "./discord-webhook";
import { open } from "./secret-box";
import { parseBannedWords } from "./message-filter";
import { planFeatures } from "./plans";
import {
  buildComment,
  chatReply,
  cleanTitle,
  cleanUser,
  commentLines,
  isVideoId,
  offsetSeconds,
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
  plan: string | null;
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

async function resolveVideoId(creator: Creator, chatId: string, deps: Deps): Promise<string | null> {
  const fromChat = videoIdFromChatId(chatId);
  if (fromChat) return fromChat;
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
      select id::text, creator_status, plan, yt_channel_id, ts_delay_seconds, banned_words,
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
  if (!planFeatures(creator.plan).timestamps) return "Timestamps are not on for this channel.";

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

    // What we already know about this stream.
    let [stream] = await db<{ creator_id: string; started_at: Date | null; title: string | null; n: number }[]>`
      select s.creator_id::text, s.started_at, s.title,
             (select count(*)::int from stream_timestamps m where m.video_id = s.video_id) as n
        from timestamp_streams s where s.video_id = ${videoId}
    `;
    if (stream && stream.creator_id !== creator.id) return "This stream belongs to another channel.";
    if (stream && stream.n >= MAX_MOMENTS_PER_STREAM) return "This stream has reached its timestamp limit.";

    // First time we see it (or its start is unknown): ask YouTube once, and make sure
    // the stream is this creator's own.
    if (!stream || !stream.started_at) {
      const videos = await deps.yt.getVideos([videoId]);
      const video = videos?.get(videoId);
      if (video) {
        if (creator.yt_channel_id && video.channelId !== creator.yt_channel_id) return "This stream belongs to another channel.";
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
      [stream] = await db<{ creator_id: string; started_at: Date | null; title: string | null; n: number }[]>`
        select s.creator_id::text, s.started_at, s.title, 0 as n from timestamp_streams s where s.video_id = ${videoId}
      `;
      if (!stream || stream.creator_id !== creator.id) return "This stream belongs to another channel.";
    }

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
