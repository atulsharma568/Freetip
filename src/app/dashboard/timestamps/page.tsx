import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { PageShell } from "@/components/PageShell";
import { SITE_NAME } from "@/lib/site";
import { planFeatures } from "@/lib/plans";
import { secretBoxAvailable } from "@/lib/secret-box";
import { youtubeConfigured } from "@/lib/youtube";
import { DashboardNav } from "../DashboardNav";
import { TimestampsManager } from "./TimestampsManager";

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

type StreamRow = { video_id: string; title: string | null; state: string; reason: string | null; n: number };

export default async function TimestampsPage({ searchParams }: { searchParams: Promise<{ yt?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const googleId = (session.user as { googleId?: string }).googleId;
  const db = getDb();
  if (!db || !googleId) redirect("/dashboard");

  const [user] = await db<{ id: string; handle: string | null; plan: string | null }[]>`
    select id::text, handle, plan from users where google_id = ${googleId}
  `;
  if (!user?.handle) redirect("/dashboard");
  if (!planFeatures(user.plan).timestamps) redirect("/dashboard");

  let migrated = true;
  let state = { hasLink: false, delay: 22, youtube: false, reconnect: false, discord: false };
  let streams: StreamRow[] = [];
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
      select s.video_id, s.title, s.state, s.reason,
             (select count(*)::int from stream_timestamps m where m.video_id = s.video_id) as n
        from timestamp_streams s where s.creator_id = ${user.id}
       order by s.created_at desc limit 10
    `;
  } catch (err) {
    console.error("Timestamps page: could not read the data (migration 0032 run?).", err);
    migrated = false;
  }

  const yt = (await searchParams).yt;
  const notice = yt ? YT_MESSAGES[yt] : undefined;
  const available = youtubeConfigured() && secretBoxAvailable();

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-2xl space-y-8 px-6 py-16">
        <DashboardNav current="timestamps" />
        <div className="space-y-3">
          <h1 className="display text-[clamp(2rem,8vw,3rem)]">Stream timestamps</h1>
          <p className="text-muted">
            Viewers and mods type <span className="numeric text-text">!ts</span> in your live chat to save a
            moment. When the stream ends, one comment with every moment is posted on it from your channel, and
            each moment can also go to your Discord.
          </p>
        </div>

        {!migrated ? (
          <p role="alert" className="text-sm text-red-400">
            Not ready yet: run db/migrations/0032_stream_timestamps.sql in Neon.
          </p>
        ) : (
          <TimestampsManager
            available={available}
            hasLink={state.hasLink}
            delay={state.delay}
            youtubeConnected={state.youtube}
            reconnectNeeded={state.reconnect}
            discordConnected={state.discord}
            notice={notice ?? null}
          />
        )}

        {migrated && (
          <section className="space-y-4 rounded-[var(--radius-surface)] border border-line/60 bg-surface p-6">
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted">Recent streams</h2>
            {streams.length === 0 ? (
              <p className="text-sm text-muted">Nothing yet. Streams show up here after the first timestamp.</p>
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
                    </div>
                    <span className="shrink-0 text-xs text-muted">
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
          </section>
        )}
      </div>
    </PageShell>
  );
}
