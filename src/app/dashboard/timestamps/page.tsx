import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { SITE_NAME } from "@/lib/site";
import { planFeatures } from "@/lib/plans";
import { secretBoxAvailable } from "@/lib/secret-box";
import { replayBufferNeeded } from "@/lib/ts-helper";
import { youtubeConfigured } from "@/lib/youtube";
import { formatOffset, offsetSeconds, youtubeMomentLink } from "@/lib/timestamps";
import { DashboardNav } from "../DashboardNav";
import { TimestampsManager } from "./TimestampsManager";
import { DashboardShell } from "../parts/DashboardShell";
import { Tile } from "../parts/Tile";
import { Msg } from "../parts/Msg";
import { EmptyState } from "../parts/EmptyState";
import { pillOutline } from "../parts/styles";

export const metadata: Metadata = {
  title: `Timestamps: ${SITE_NAME}`,
  robots: { index: false },
};

const YT_MESSAGES: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "YouTube connected. Timestamps will be posted as a comment on your channel." },
  declined: { ok: false, text: "YouTube was not connected: the comment permission was not given." },
  failed: { ok: false, text: "YouTube could not be connected. Try again." },
  wrong_channel: { ok: false, text: "That Google account is not the YouTube channel you signed up with. Pick the same channel." },
  unavailable: { ok: false, text: "This is not switched on for the site yet." },
};

const REASONS: Record<string, string> = {
  not_connected: "YouTube is not connected",
  reconnect: "reconnect YouTube",
  quota: "waiting for YouTube's daily limit",
  token: "YouTube sign-in problem, will retry",
  not_commentable: "comments are off on this video",
  not_allowed: "YouTube would not allow the comment",
  not_owner: "not your stream",
  never_live: "the stream never went live",
  unavailable: "video not available",
  no_timestamps: "no timestamps saved",
  unknown: "YouTube did not confirm, not retried",
  interrupted: "stopped half way, not retried",
};

type StreamRow = {
  video_id: string;
  title: string | null;
  state: string;
  reason: string | null;
  n: number;
  started_at: Date | null;
};
type MomentRow = { video_id: string; title: string | null; created_at: Date; delay_seconds: number };

const MOMENTS_SHOWN = 20;

export default async function TimestampsPage({ searchParams }: { searchParams: Promise<{ yt?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const googleId = (session.user as { googleId?: string }).googleId;
  const db = getDb();
  if (!db || !googleId) redirect("/dashboard");

  const [user] = await db<
    { id: string; handle: string | null; paid_features: string[] | null; creator_status: string }[]
  >`
    select id::text, handle, paid_features, creator_status from users where google_id = ${googleId}
  `;
  if (!user?.handle) redirect("/dashboard");
  const features = planFeatures(user);
  if (!features.timestamps) redirect("/dashboard");

  let migrated = true;
  let state = { hasLink: false, delay: 22, youtube: false, reconnect: false, discord: false };
  let streams: StreamRow[] = [];
  let moments: MomentRow[] = [];
  try {
    const [row] = await db<
      { has_link: boolean; delay: number; yt: boolean; reconnect: boolean; discord: boolean }[]
    >`
      select ts_token_hash is not null as has_link, ts_delay_seconds as delay,
             yt_refresh_token_enc is not null as yt, yt_reconnect_needed as reconnect,
             discord_webhook_enc is not null as discord
        from users where id = ${user.id}
    `;
    state = { hasLink: row.has_link, delay: row.delay, youtube: row.yt, reconnect: row.reconnect, discord: row.discord };
    streams = await db<StreamRow[]>`
      select s.video_id, s.title, s.state, s.reason, s.started_at,
             (select count(*)::int from stream_timestamps m where m.video_id = s.video_id) as n
        from timestamp_streams s where s.creator_id = ${user.id}
       order by s.created_at desc limit 10
    `;
    if (streams.length) {
      moments = await db<MomentRow[]>`
        select video_id, title, created_at, delay_seconds
          from stream_timestamps
         where creator_id = ${user.id} and video_id in ${db(streams.map((s) => s.video_id))}
         order by created_at asc limit 500
      `;
    }
  } catch (err) {
    console.error("Timestamps page: could not read the data (migration 0032 run?).", err);
    migrated = false;
  }

  // Phase 2 columns (migration 0033), read apart so the page works before it is run.
  let extras = { tipMinRupees: null as number | null, isPublic: false, hasEditorLink: false, ready: true };
  try {
    const [row] = await db<{ tip_min: number | null; is_public: boolean; has_editor: boolean }[]>`
      select ts_tip_min_paise as tip_min, ts_public as is_public, ts_editor_token_hash is not null as has_editor
        from users where id = ${user.id}
    `;
    extras = { tipMinRupees: row.tip_min === null ? null : Math.round(row.tip_min / 100), isPublic: row.is_public, hasEditorLink: row.has_editor, ready: true };
  } catch (err) {
    console.error("Timestamps page: could not read the extras (migration 0033 run?).", err);
    extras.ready = false;
  }

  // Phase 3 columns (migration 0034), read apart so the page works before it is run.
  let helper = { hasToken: false, seenSecondsAgo: null as number | null, ready: true };
  try {
    const [row] = await db<{ has_token: boolean; seen: number | null }[]>`
      select ts_helper_token_hash is not null as has_token,
             extract(epoch from (now() - ts_helper_seen_at))::int as seen
        from users where id = ${user.id}
    `;
    helper = { hasToken: row.has_token, seenSecondsAgo: row.seen, ready: true };
  } catch (err) {
    console.error("Timestamps page: could not read the helper settings (migration 0034 run?).", err);
    helper.ready = false;
  }

  const yt = (await searchParams).yt;
  const notice = yt ? YT_MESSAGES[yt] : undefined;
  const available = youtubeConfigured() && secretBoxAvailable();

  return (
    <DashboardShell handle={user.handle} live={user.creator_status === "active"}>
      <div className="mx-auto w-full max-w-2xl space-y-8 px-6 pb-24 pt-4">
        <DashboardNav current="timestamps" />
        <div className="space-y-3">
          <h1 className="display text-[clamp(2.25rem,8vw,3.5rem)]">Stream timestamps</h1>
          <p className="text-muted">
            Viewers and mods type <span className="numeric text-text">!ts</span> in your live chat to save a
            moment. When the stream ends, one comment with every moment is posted on it from your channel, and
            each moment can also go to your Discord.
          </p>
        </div>

        {!migrated ? (
          <Msg kind="error" text="Not ready yet: run db/migrations/0032_stream_timestamps.sql in Neon." />
        ) : (
          <TimestampsManager
            available={available}
            hasLink={state.hasLink}
            delay={state.delay}
            youtubeConnected={state.youtube}
            reconnectNeeded={state.reconnect}
            discordConnected={state.discord}
            notice={notice ?? null}
            extras={extras}
            tipPlan={features.tipMarks}
            highlightsPlan={features.highlightsPage}
            editorPlan={features.editorLink}
            clipPlan={features.clipHelper}
            helper={helper}
            bufferSeconds={replayBufferNeeded(state.delay)}
          />
        )}

        {migrated && (
          <Tile id="recent-streams" level={2} title="Recent streams">
            {streams.length === 0 ? (
              <EmptyState
                sample={
                  <div className="flex items-start justify-between gap-4 rounded-field border border-line/60 bg-ground px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-text">Friday night stream</p>
                      <p className="text-xs text-muted">3 moments</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted">Posted</span>
                  </div>
                }
                title="Nothing yet."
                body="Streams show up here after the first timestamp. The one above is a sample."
                cta={
                  <a href="#ts-command" className={pillOutline}>
                    Set up the chat command
                  </a>
                }
              />
            ) : (
              <ul className="divide-y divide-line/60">
                {streams.map((s) => (
                  <li key={s.video_id} className="flex items-start justify-between gap-4 py-3 text-sm">
                    <div className="min-w-0">
                      <a
                        href={`https://youtu.be/${s.video_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-text underline-offset-4 hover:underline"
                      >
                        {s.title || s.video_id}
                      </a>
                      <span className="text-xs text-muted">
                        {s.n} {s.n === 1 ? "moment" : "moments"}
                        {s.reason ? `, ${REASONS[s.reason] ?? s.reason}` : ""}
                      </span>
                      {s.started_at && (
                        <ul className="mt-2 space-y-1">
                          {moments
                            .filter((m) => m.video_id === s.video_id)
                            .slice(0, MOMENTS_SHOWN)
                            .map((m) => {
                              const at = offsetSeconds(m.created_at, s.started_at as Date, m.delay_seconds);
                              return (
                                <li key={`${m.created_at}-${m.title}`} className="truncate text-xs">
                                  <a
                                    href={youtubeMomentLink(s.video_id, at)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-text underline-offset-4 hover:underline"
                                  >
                                    {formatOffset(at)}
                                  </a>
                                  {m.title ? <span className="text-muted"> {m.title}</span> : null}
                                </li>
                              );
                            })}
                        </ul>
                      )}
                    </div>
                    <span className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted">
                      {extras.isPublic && s.n > 0 && (
                        <a
                          href={`/${user.handle}/highlights/${s.video_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-text underline-offset-4 hover:underline"
                        >
                          Public page
                        </a>
                      )}
                      {s.state === "posted"
                        ? "Posted"
                        : s.state === "queued"
                          ? "Waiting for the stream to end"
                          : s.state === "posting"
                            ? "Posting"
                            : s.state === "skipped"
                              ? "Skipped"
                              : "Failed"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Tile>
        )}
      </div>
    </DashboardShell>
  );
}
