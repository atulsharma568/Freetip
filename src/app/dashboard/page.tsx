import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { planFeatures } from "@/lib/plans";
import { HandleSetup } from "./HandleSetup";
import { PayoutOnboarding } from "./PayoutOnboarding";
import { SettingsForm } from "./SettingsForm";
import { CloseAccount } from "./CloseAccount";
import { RenameHandle, type HandleRequestView } from "./RenameHandle";
import { CreatorQR } from "./CreatorQR";
import { GoalTile, type GoalHistoryRow, type GoalView } from "./GoalTile";
import { OverlayTile } from "./OverlayTile";
import { TipIsland } from "./TipIsland";
import { VoiceTest } from "./VoiceTest";
import { DashboardNav } from "./DashboardNav";
import { OverviewStrip } from "./OverviewStrip";
import { DailyChart } from "./DailyChart";
import { NextStepCard } from "./NextStepCard";
import { nextStep } from "@/lib/next-step";
import { loadDailyTips, loadOverview } from "./queries";
import { MessageQueue, type PendingMessage } from "./MessageQueue";
import type { AlertMode } from "@/lib/alerts";
import { ttsAvailable } from "@/lib/tts";
import { parseRepeat, parseTimezone } from "@/lib/goal";
import { loadGoalProgress } from "@/lib/goal-progress";
import type { Query } from "@/lib/accrual";
import { closeFinishedPeriods } from "@/lib/goal-history";
import { safeAccent } from "@/lib/accent";
import { SITE_NAME, SITE_HOST } from "@/lib/site";
import { DashboardShell } from "./parts/DashboardShell";
import { Group, Tile } from "./parts/Tile";
import { Reveal } from "./parts/Reveal";
import { SectionRail } from "./parts/SectionRail";

// The Test voice button runs as a server action on this route; Azure (6 s) and then
// Polly can together outlast the default function time, which shows up as a failed call.
export const maxDuration = 30;

export const metadata: Metadata = {
  title: `Dashboard: ${SITE_NAME}`,
  robots: { index: false },
};

type CreatorStatus = "pending" | "active" | "suspended";
type OnboardingState = "not_started" | "submitted" | "active" | "rejected";

interface UserRow {
  id: number;
  handle: string | null;
  creator_status: CreatorStatus;
  onboarding_state: OnboardingState;
  name: string | null;
  picture_url: string | null;
  display_name: string | null;
  legal_name: string | null;
  upi_vpa: string | null;
  min_tip_paise: number;
  message_max_chars: number;
  tts_enabled: boolean;
  tts_min_paise: number;
  approve_before_play: boolean;
  bio: string | null;
  alert_mode: AlertMode;
  has_overlay_link: boolean;
}

type Db = NonNullable<ReturnType<typeof getDb>>;

// Each read below is its own function so the dashboard can run them side by side.
// The columns added by later migrations are read apart, each with its own fallback,
// so the page still loads before a migration is run.

async function readBannedWords(db: Db, userId: number): Promise<string> {
  try {
    const [found] = await db<{ banned_words: string }[]>`select banned_words from users where id = ${userId}`;
    return found?.banned_words ?? "";
  } catch (err) {
    console.error("Dashboard: could not read the banned words.", err);
    return "";
  }
}

async function readVoiceGender(db: Db, userId: number): Promise<"female" | "male"> {
  try {
    const [found] = await db<{ tts_voice: string }[]>`select tts_voice from users where id = ${userId}`;
    return found?.tts_voice === "male" ? "male" : "female";
  } catch (err) {
    console.error("Dashboard: could not read the voice choice (migration 0029 run?).", err);
    return "female";
  }
}

// Whether the one handle change is used (migration 0030), then the latest request
// (migration 0031), which is only looked up while the change is still unused.
async function readHandleChange(
  db: Db,
  userId: number,
): Promise<{ handleChanged: boolean; handleRequest: HandleRequestView }> {
  let handleChanged = false;
  try {
    const found = await db<{ one: number }[]>`select 1 as one from handle_history where user_id = ${userId}`;
    handleChanged = found.length > 0;
  } catch (err) {
    console.error("Dashboard: could not read the handle history (migration 0030 run?).", err);
  }
  let handleRequest: HandleRequestView = null;
  if (!handleChanged) {
    try {
      const [found] = await db<{ status: "pending" | "approved" | "rejected"; requested_handle: string; decision_note: string | null }[]>`
        select status, requested_handle, decision_note from handle_requests
        where user_id = ${userId} order by (status = 'pending') desc, created_at desc limit 1
      `;
      if (found && found.status !== "approved") {
        handleRequest = { status: found.status, requested: found.requested_handle, note: found.decision_note };
      }
    } catch (err) {
      console.error("Dashboard: could not read the handle request (migration 0031 run?).", err);
    }
  }
  return { handleChanged, handleRequest };
}

async function readAccent(db: Db, userId: number): Promise<string | null> {
  try {
    const [found] = await db<{ accent: string | null }[]>`select accent from users where id = ${userId}`;
    return found?.accent ?? null;
  } catch (err) {
    console.error("Dashboard: could not read the accent colour.", err);
    return null;
  }
}

// Which extra overlays are switched on for this creator (migration 0035).
async function readExtraOverlays(db: Db, userId: number): Promise<{ path: string; label: string }[]> {
  const extras: { path: string; label: string }[] = [];
  try {
    const [found] = await db<{ paid_features: string[] | null }[]>`select paid_features from users where id = ${userId}`;
    const f = planFeatures(found);
    if (f.supportStreak) extras.push({ path: "/streak", label: "Support streak" });
    if (f.topSupporter) extras.push({ path: "/top", label: "Top supporter" });
    if (f.recentSupporters) extras.push({ path: "/recent", label: "Recent supporters" });
  } catch (err) {
    console.error("Dashboard: could not read the paid features.", err);
  }
  return extras;
}

// The goal bars (migrations 0018, 0027, 0028): each goal's progress and the finished periods.
async function readGoals(db: Db, userId: number): Promise<{ goalViews: GoalView[]; goalHistory: GoalHistoryRow[] }> {
  try {
    const q = db as unknown as Query;
    await closeFinishedPeriods(q, userId);
    const progress = await loadGoalProgress(q, userId);
    const goalViews: GoalView[] = progress.map((g) => ({
      id: g.id,
      title: g.title,
      targetRupees: Math.round(g.targetPaise / 100),
      repeat: g.repeat,
      timezone: g.timezone,
      carryOver: g.carryOver,
      carryRupees: Math.round(g.carryPaise / 100),
      raisedRupees: Math.floor(g.raisedPaise / 100),
    }));
    const rows = await db<
      { repeat: string; period_start: Date; title: string; target_paise: string; carry_paise: string; raised_paise: string; hit: boolean; timezone: string }[]
    >`
      select repeat, period_start, title, target_paise, carry_paise, raised_paise, hit, timezone from goal_history
      where creator_id = ${userId} order by period_start desc, goal_id limit 8
    `;
    const goalHistory: GoalHistoryRow[] = rows.map((r) => ({
      repeat: parseRepeat(r.repeat),
      periodStart: r.period_start.toISOString(),
      title: r.title,
      targetRupees: Math.round(Number(r.target_paise) / 100),
      carryRupees: Math.round(Number(r.carry_paise) / 100),
      raisedRupees: Math.floor(Number(r.raised_paise) / 100),
      hit: r.hit,
      timezone: parseTimezone(r.timezone),
    }));
    return { goalViews, goalHistory };
  } catch (err) {
    console.error("Dashboard: could not read the goals (migration 0028 run?).", err);
    return { goalViews: [], goalHistory: [] };
  }
}

// Messages waiting for approval (split and approve modes only).
async function readPending(db: Db, userId: number, alertMode: AlertMode): Promise<PendingMessage[]> {
  if (alertMode === "instant") return [];
  return db<PendingMessage[]>`
    select id::int as id, fan_name, fan_message, gross_amount_minor
    from tip_orders
    where creator_id = ${userId}
      and status = 'captured'
      and message_status = 'pending'
      and btrim(coalesce(fan_message, '')) <> ''
      and captured_at > now() - interval '7 days'
    order by captured_at
    limit 20
  `;
}

// Newest captured tip, so the live island only announces tips that arrive
// while the dashboard is open.
async function readLatestTipId(db: Db, userId: number): Promise<number> {
  const [latest] = await db<{ id: number }[]>`
    select coalesce(max(id), 0)::int as id
    from tip_orders
    where creator_id = ${userId} and status = 'captured'
  `;
  return latest?.id ?? 0;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const googleId = (session.user as { googleId?: string }).googleId;
  const db = getDb();

  let user: UserRow | null = null;
  if (db && googleId) {
    const rows = await db<UserRow[]>`
      select id, handle, creator_status, onboarding_state,
             name, picture_url, display_name, legal_name, upi_vpa,
             min_tip_paise, message_max_chars, tts_enabled, tts_min_paise, approve_before_play, bio,
             alert_mode, overlay_token_hash is not null as has_overlay_link
      from users
      where google_id = ${googleId}
    `;
    user = rows[0] ?? null;
  }

  const firstName = session.user.name?.split(" ")[0] ?? "Creator";

  // No DB or no row yet — fallback to early-access screen.
  if (!db || !user) {
    return (
      <DashboardShell>
        <EarlyAccess firstName={firstName} avatarUrl={session.user.image ?? null} />
      </DashboardShell>
    );
  }

  // Handle not yet chosen.
  if (!user.handle) {
    return (
      <DashboardShell>
        <HandleSetup />
      </DashboardShell>
    );
  }

  const handle = user.handle;
  const [
    bannedWords,
    voiceGender,
    { handleChanged, handleRequest },
    accent,
    extras,
    { goalViews, goalHistory },
    pending,
    latestTipId,
    overview,
    daily,
  ] = await Promise.all([
    readBannedWords(db, user.id),
    readVoiceGender(db, user.id),
    readHandleChange(db, user.id),
    readAccent(db, user.id),
    readExtraOverlays(db, user.id),
    readGoals(db, user.id),
    readPending(db, user.id, user.alert_mode),
    readLatestTipId(db, user.id),
    loadOverview(user.id),
    loadDailyTips(user.id, 30),
  ]);

  const step = nextStep({
    creatorStatus: user.creator_status,
    onboardingState: user.onboarding_state,
    hasOverlayLink: user.has_overlay_link,
    tipCount: overview.find((r) => r.key === "all")?.count ?? 0,
  });
  const shareUrl = `https://${SITE_HOST}/${handle}`;
  const suspended = user.creator_status === "suspended";
  const showQueue = user.alert_mode !== "instant";

  // Handle set — three groups: what happened today, the stream, the account.
  return (
    <DashboardShell handle={handle} live={user.creator_status === "active"}>
      <TipIsland initialLastId={latestTipId} />
      <div>
        <div className="mx-auto w-full max-w-7xl space-y-8 px-6 pb-10 pt-4">
          <DashboardNav current="overview" />
          <div className="flex items-center gap-4">
            {user.picture_url && (
              <Image
                src={user.picture_url}
                alt="Your profile photo"
                loading="eager"
                width={56}
                height={56}
                className="shrink-0 rounded-full"
              />
            )}
            <h1 className="display min-w-0 break-words text-[clamp(2.25rem,6vw,4rem)]">Hey, {firstName}.</h1>
          </div>
        </div>

        <SectionRail />

        <div className="mx-auto w-full max-w-7xl px-6 pb-24">
          <Reveal>
            <Group id="today" title="Today">
              <NextStepCard step={step} handle={handle} suspended={suspended} />
              <OverviewStrip rows={overview} shareUrl={shareUrl} />
              <div className={`grid items-start gap-4 ${showQueue ? "lg:grid-cols-2" : ""}`}>
                {daily.length > 0 && <DailyChart days={daily} shareUrl={shareUrl} />}
                {showQueue && (
                  <Tile id="queue" title="Messages to approve">
                    <MessageQueue items={pending} />
                  </Tile>
                )}
              </div>
            </Group>

            <Group id="stream" title="Stream">
              <div className="grid items-start gap-4 lg:grid-cols-2">
                <div className="min-w-0 space-y-4">
                  <Tile id="alerts" title="Alerts on stream">
                    <OverlayTile hasLink={user.has_overlay_link} />
                  </Tile>
                  {extras.length > 0 && (
                    <Tile id="overlays" title="More overlays">
                      <p className="text-sm text-muted">
                        Add your alert link to OBS as another Browser source and put the ending below on it. Each one
                        shows nothing until there is something to show, and the page colour you picked is used.
                      </p>
                      <ul className="space-y-1 text-sm">
                        {extras.map((e) => (
                          <li key={e.path} className="flex justify-between gap-4">
                            <span className="min-w-0 text-text">{e.label}</span>
                            <span className="numeric shrink-0 text-muted">{e.path}</span>
                          </li>
                        ))}
                      </ul>
                    </Tile>
                  )}
                  {ttsAvailable() && !suspended && (
                    <Tile id="voice" title="Test the voice">
                      <VoiceTest maxChars={user.message_max_chars} />
                    </Tile>
                  )}
                </div>
                <div className="min-w-0 space-y-4">
                  <Tile id="goals" title="Goal bars">
                    <GoalTile goals={goalViews} history={goalHistory} />
                  </Tile>
                </div>
              </div>
            </Group>

            <Group id="account" title="Account">
              <div className="grid items-start gap-4 lg:grid-cols-2">
                <div className="min-w-0 space-y-4">
                  {/* Payout onboarding gate: shown while pending */}
                  {user.creator_status === "pending" && (
                    <PayoutOnboarding
                      state={user.onboarding_state}
                      initialLegalName={user.legal_name ?? user.name ?? ""}
                      initialUpiVpa={user.upi_vpa ?? ""}
                    />
                  )}
                  <Tile id="tip-page" title="Your tip page">
                    <Link
                      href={`/${handle}`}
                      className="numeric block break-all text-lg font-semibold text-text underline decoration-line underline-offset-4 transition-colors hover:decoration-accent"
                    >
                      {SITE_HOST}/{handle}
                    </Link>
                    <StatusBadge status={user.creator_status} />
                    <div className="border-t border-line/60 pt-4">
                      <RenameHandle current={handle} used={handleChanged} request={handleRequest} />
                    </div>
                  </Tile>
                  <Tile id="qr" title="Your QR code">
                    <CreatorQR url={shareUrl} handle={handle} />
                  </Tile>
                </div>
                {/* Tip page settings: available regardless of activation status */}
                <Tile id="settings" title="Tip page settings" className="min-w-0">
                  <p className="text-sm text-muted">Changes apply the next time someone loads your tip page.</p>
                  <SettingsForm
                    displayName={user.display_name ?? ""}
                    messageMaxChars={user.message_max_chars}
                    ttsEnabled={user.tts_enabled}
                    ttsMinPaise={user.tts_min_paise}
                    approveBeforePlay={user.approve_before_play}
                    alertMode={user.alert_mode}
                    bio={user.bio ?? ""}
                    bannedWords={bannedWords}
                    accent={safeAccent(accent)}
                    ttsAvailable={ttsAvailable()}
                    voiceGender={voiceGender}
                  />
                </Tile>
              </div>
              <CloseAccount />
            </Group>
          </Reveal>
        </div>
      </div>
    </DashboardShell>
  );
}

// The status as a pill: lime and solid while tips are open, a Control Edge outline otherwise.
function StatusBadge({ status }: { status: CreatorStatus }) {
  const label = status === "active" ? "Live" : status === "pending" ? "Pending setup" : "Suspended";
  return (
    <p
      className={`inline-flex h-7 items-center gap-2 rounded-full px-3 text-xs font-semibold ${
        status === "active" ? "bg-accent text-ink" : "border border-control text-text"
      }`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${status === "active" ? "bg-ink" : "bg-text"}`} />
      {label}
    </p>
  );
}

function EarlyAccess({
  firstName,
  avatarUrl,
}: {
  firstName: string;
  avatarUrl: string | null;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md space-y-8 text-center">
        {avatarUrl && (
          <Image
            src={avatarUrl}
            alt="Your profile photo"
            loading="eager"
            width={64}
            height={64}
            className="mx-auto rounded-full"
          />
        )}
        <div className="space-y-3">
          <h1 className="display text-[clamp(2rem,8vw,3rem)]">
            You&apos;re in, {firstName}.
          </h1>
          <p className="text-pretty text-lg text-muted">
            Early access is reserved. We&apos;re building the tip page and
            creator tools now — we&apos;ll email you when your link is ready.
          </p>
        </div>
        <div className="rounded-[var(--radius-surface)] border border-line/60 bg-surface px-6 py-5 text-left space-y-3">
          <h2 className="text-sm font-medium text-muted uppercase tracking-widest">
            What&apos;s coming
          </h2>
          <ul className="space-y-2 text-base text-text">
            {[
              `Your ${SITE_HOST}/handle link`,
              "UPI and card tips from fans",
              "OBS alerts with fan messages",
              "Text-to-speech (approve before play)",
              "No fan account or email needed",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
