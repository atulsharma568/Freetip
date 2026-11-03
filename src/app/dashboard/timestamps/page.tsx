import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { SITE_NAME } from "@/lib/site";
import { planFeatures } from "@/lib/plans";
import { open, secretBoxAvailable } from "@/lib/secret-box";
import { nightbotCommand } from "@/lib/ts-command";
import { replayBufferNeeded } from "@/lib/ts-helper";
import { youtubeConfigured } from "@/lib/youtube";
import { DashboardNav } from "../DashboardNav";
import { TimestampsManager } from "./TimestampsManager";
import { DashboardShell } from "../parts/DashboardShell";
import { Msg } from "../parts/Msg";
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

  // The encrypted copy of the chat command (migration 0049), read apart so the page works before it is run.
  let currentCommand: string | null = null;
  try {
    const [row] = await db<{ enc: string | null }[]>`select ts_token_enc as enc from users where id = ${user.id}`;
    const token = open(row?.enc);
    if (token) currentCommand = nightbotCommand(token);
  } catch (err) {
    console.error("Timestamps page: could not read the saved command (migration 0049 run?).", err);
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
          {migrated && (
            <Link href="/dashboard/timestamps/streams" className={pillOutline}>
              All streams and moments
            </Link>
          )}
        </div>

        {!migrated ? (
          <Msg kind="error" text="Not ready yet: run db/migrations/0032_stream_timestamps.sql in Neon." />
        ) : (
          <TimestampsManager
            available={available}
            hasLink={state.hasLink}
            currentCommand={currentCommand}
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

      </div>
    </DashboardShell>
  );
}
