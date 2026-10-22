import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { PageShell } from "@/components/PageShell";
import { HandleSetup } from "./HandleSetup";
import { SettingsForm } from "./SettingsForm";
import { SITE_NAME, SITE_HOST } from "@/lib/site";

export const metadata: Metadata = {
  title: `Dashboard: ${SITE_NAME}`,
  robots: { index: false },
};

type CreatorStatus = "pending" | "active" | "suspended";

interface UserRow {
  handle: string | null;
  creator_status: CreatorStatus;
  name: string | null;
  picture_url: string | null;
  min_tip_paise: number;
  message_max_chars: number;
  tts_enabled: boolean;
  approve_before_play: boolean;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const googleId = (session.user as { googleId?: string }).googleId;
  const db = getDb();

  let user: UserRow | null = null;
  if (db && googleId) {
    const rows = await db<UserRow[]>`
      select handle, creator_status, name, picture_url,
             min_tip_paise, message_max_chars, tts_enabled, approve_before_play
      from users
      where google_id = ${googleId}
    `;
    user = rows[0] ?? null;
  }

  const firstName = session.user.name?.split(" ")[0] ?? "Creator";

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

  // Handle set — show tip page link and activation status.
  return (
    <PageShell>
      <div className="mx-auto w-full max-w-lg space-y-8 px-6 py-16">
        {user.picture_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.picture_url}
            alt=""
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

        {/* Tip page link */}
        <div className="rounded-[var(--radius-surface)] border border-line/60 bg-surface p-6 space-y-3">
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

        {/* Status tile */}
        {user.creator_status === "pending" && (
          <div className="rounded-[var(--radius-surface)] border border-line/60 bg-surface p-6 space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted">
              Status
            </h2>
            <p className="text-text">
              Payments aren&apos;t open yet. We&apos;ll email you when you can
              connect payouts and go live.
            </p>
            <p className="text-sm text-muted">
              Fans who visit your link see &ldquo;Not live yet&rdquo; until then.{" "}
              <Link
                href="/contact"
                className="text-text underline decoration-line underline-offset-4 transition-colors hover:decoration-accent"
              >
                Questions? Contact us.
              </Link>
            </p>
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
            minTipPaise={user.min_tip_paise}
            messageMaxChars={user.message_max_chars}
            ttsEnabled={user.tts_enabled}
            approveBeforePlay={user.approve_before_play}
          />
        </div>
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
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
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
