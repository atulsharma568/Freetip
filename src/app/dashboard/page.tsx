import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { PageShell } from "@/components/PageShell";
import { HandleSetup } from "./HandleSetup";
import { PayoutOnboarding } from "./PayoutOnboarding";
import { SettingsForm } from "./SettingsForm";
import { CloseAccount } from "./CloseAccount";
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

  // The creator's banned words (migration 0016), read apart so the dashboard still
  // loads before that migration is run.
  let bannedWords = "";
  if (db && user) {
    try {
      const [found] = await db<{ banned_words: string }[]>`select banned_words from users where id = ${user.id}`;
      bannedWords = found?.banned_words ?? "";
    } catch (err) {
      console.error("Dashboard: could not read the banned words.", err);
    }
  }

  // The accent colour (migration 0026), read apart so the dashboard loads before it is run.
  let accent: string | null = null;
  if (db && user) {
    try {
      const [found] = await db<{ accent: string | null }[]>`select accent from users where id = ${user.id}`;
      accent = found?.accent ?? null;
    } catch (err) {
      console.error("Dashboard: could not read the accent colour.", err);
    }
  }

  // The goal bars (migrations 0018, 0027, 0028), read apart so the dashboard loads
  // before they are run: each goal's progress and the finished periods.
  let goalViews: GoalView[] = [];
  let goalHistory: GoalHistoryRow[] = [];
  if (db && user) {
    try {
      const q = db as unknown as Query;
      await closeFinishedPeriods(q, user.id);
      const progress = await loadGoalProgress(q, user.id);
      goalViews = progress.map((g) => ({
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
        where creator_id = ${user.id} order by period_start desc, goal_id limit 8
      `;
      goalHistory = rows.map((r) => ({
        repeat: parseRepeat(r.repeat),
        periodStart: r.period_start.toISOString(),
        title: r.title,
        targetRupees: Math.round(Number(r.target_paise) / 100),
        carryRupees: Math.round(Number(r.carry_paise) / 100),
        raisedRupees: Math.floor(Number(r.raised_paise) / 100),
        hit: r.hit,
        timezone: parseTimezone(r.timezone),
      }));
    } catch (err) {
      console.error("Dashboard: could not read the goals (migration 0028 run?).", err);
    }
  }

  const firstName = session.user.name?.split(" ")[0] ?? "Creator";

  // Messages waiting for approval (split and approve modes only).
  let pending: PendingMessage[] = [];
  if (db && user?.handle && user.alert_mode !== "instant") {
    pending = await db<PendingMessage[]>`
      select id::int as id, fan_name, fan_message, gross_amount_minor
      from tip_orders
      where creator_id = ${user.id}
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
  let latestTipId = 0;
  if (db && user?.handle) {
    const [latest] = await db<{ id: number }[]>`
      select coalesce(max(id), 0)::int as id
      from tip_orders
      where creator_id = ${user.id} and status = 'captured'
    `;
    latestTipId = latest?.id ?? 0;
  }

  const [overview, daily] =
    db && user?.handle
      ? await Promise.all([loadOverview(user.id), loadDailyTips(user.id, 30)])
      : [[], []];

  // No DB or no row yet — fallback to early-access screen.
  if (!db || !user) {
    return (
      <PageShell>
        <EarlyAccess firstName={firstName} avatarUrl={session.user.image ?? null} />
      </PageShell>
    );
  }

  // Handle not yet chosen.
  if (!user.handle) {
    return (
      <PageShell>
        <HandleSetup />
      </PageShell>
    );
  }

  const step = nextStep({
    creatorStatus: user.creator_status,
    onboardingState: user.onboarding_state,
    hasOverlayLink: user.has_overlay_link,
    tipCount: overview.find((r) => r.key === "all")?.count ?? 0,
  });

  // Handle set — show tip page link and activation status.
  return (
    <PageShell>
      <TipIsland initialLastId={latestTipId} />
      <div className="mx-auto w-full max-w-2xl space-y-8 px-6 py-16">
        <DashboardNav current="overview" />

        {user.picture_url && (
          <Image
            src={user.picture_url}
            alt="Your profile photo"
            loading="eager"
            width={56}
            height={56}
            className="rounded-full"
          />
        )}

        <div className="space-y-2">
          <h1 className="display text-[clamp(2rem,8vw,3rem)]">
            Hey, {firstName}.
          </h1>
          <p className="text-lg text-muted">
            Your link is claimed. Here&apos;s where things stand.
          </p>
        </div>

        {step && <NextStepCard step={step} />}

        <OverviewStrip rows={overview} />
        {daily.length > 0 && <DailyChart days={daily} />}

        {/* Tip page link */}
        <div id="tip-page" className="scroll-mt-6 rounded-[var(--radius-surface)] border border-line/60 bg-surface p-6 space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted">
            Your tip page
          </h2>
          <Link
            href={`/${user.handle}`}
            className="numeric text-lg font-semibold text-text underline decoration-line underline-offset-4 transition-colors hover:decoration-accent"
          >
            {SITE_HOST}/{user.handle}
          </Link>
          <StatusBadge status={user.creator_status} />
        </div>

        {/* QR code */}
        <div className="rounded-[var(--radius-surface)] border border-line/60 bg-surface p-6 space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted">
            Your QR code
          </h2>
          <CreatorQR
            url={`https://${SITE_HOST}/${user.handle}`}
            handle={user.handle}
          />
        </div>

        {/* Payout onboarding gate — shown while pending */}
        {user.creator_status === "pending" && (
          <div id="payout" className="scroll-mt-6">
            <PayoutOnboarding
              state={user.onboarding_state}
              initialLegalName={user.legal_name ?? user.name ?? ""}
              initialUpiVpa={user.upi_vpa ?? ""}
            />
          </div>
        )}

        {user.creator_status === "active" && (
          <p className="text-sm text-muted">
            Your tip page is live. Share{" "}
            <span className="numeric text-text">
              {SITE_HOST}/{user.handle}
            </span>{" "}
            with your community.
          </p>
        )}

        {user.creator_status === "suspended" && (
          <p className="text-sm text-muted">
            Your account is suspended.{" "}
            <Link href="/contact" className="text-text underline decoration-line hover:decoration-accent">
              Contact support
            </Link>{" "}
            to find out why.
          </p>
        )}

        {/* OBS alerts */}
        <div id="alerts" className="scroll-mt-6 rounded-[var(--radius-surface)] border border-line/60 bg-surface p-6 space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted">
            Alerts on stream
          </h2>
          <OverlayTile hasLink={user.has_overlay_link} />
        </div>

        {ttsAvailable() && user.creator_status !== "suspended" && (
          <div className="rounded-[var(--radius-surface)] border border-line/60 bg-surface p-6 space-y-4">
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted">
              Test the voice
            </h2>
            <VoiceTest maxChars={user.message_max_chars} />
          </div>
        )}

        <div className="rounded-[var(--radius-surface)] border border-line/60 bg-surface p-6 space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted">
            Goal bars
          </h2>
          <GoalTile goals={goalViews} history={goalHistory} />
        </div>

        {user.alert_mode !== "instant" && (
          <div className="rounded-[var(--radius-surface)] border border-line/60 bg-surface p-6 space-y-4">
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted">
              Messages to approve
            </h2>
            <MessageQueue items={pending} />
          </div>
        )}

        {/* Tip page settings — available regardless of activation status */}
        <div className="rounded-[var(--radius-surface)] border border-line/60 bg-surface p-6 space-y-5">
          <div className="space-y-1">
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted">
              Tip page settings
            </h2>
            <p className="text-sm text-muted">
              Changes apply the next time someone loads your tip page.
            </p>
          </div>
          <SettingsForm
            displayName={user.display_name ?? ""}
            minTipPaise={user.min_tip_paise}
            messageMaxChars={user.message_max_chars}
            ttsEnabled={user.tts_enabled}
            ttsMinPaise={user.tts_min_paise}
            approveBeforePlay={user.approve_before_play}
            alertMode={user.alert_mode}
            bio={user.bio ?? ""}
            bannedWords={bannedWords}
            accent={safeAccent(accent)}
            ttsAvailable={ttsAvailable()}
          />
        </div>
        <CloseAccount />
      </div>
    </PageShell>
  );
}

function StatusBadge({ status }: { status: CreatorStatus }) {
  const styles: Record<CreatorStatus, { dot: string; label: string; text: string }> = {
    pending: { dot: "bg-yellow-400", label: "Pending setup", text: "text-muted" },
    active: { dot: "bg-accent animate-dot-pulse", label: "Live", text: "text-text" },
    suspended: { dot: "bg-red-400", label: "Suspended", text: "text-muted" },
  };
  const s = styles[status];
  return (
    <p className={`flex items-center gap-2 text-sm font-medium ${s.text}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden="true" />
      {s.label}
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
