import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { SITE_NAME } from "@/lib/site";
import type { Query } from "@/lib/accrual";
import { formatRupees } from "@/lib/earnings";
import { HOLD_DAYS_NEW_CREATOR, HOLD_DAYS_OTHER, HOLD_DAYS_UPI } from "@/lib/balances";
import {
  STATEMENT_PAGE_SIZE,
  loadEarningsSummary,
  loadStatement,
  type EarningsSummary,
} from "@/lib/creator-earnings";
import { statusWord, type StatementRow } from "@/lib/earnings-statement";
import { FIRST_PAYOUT_MAX_PAISE, MIN_PAYOUT_PAISE, PAYOUT_MAX_PAISE, amountToRequest, payoutRef } from "@/lib/payouts";
import { DashboardNav } from "../DashboardNav";
import { DashboardShell } from "../parts/DashboardShell";

export const metadata: Metadata = {
  title: `Earnings: ${SITE_NAME}`,
  robots: { index: false },
};

export const dynamic = "force-dynamic";

const dateTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});
const dateOnly = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });

const PAYOUT_WORDS: Record<string, string> = {
  scheduled: "Scheduled",
  held: "On hold",
  initiated: "Started, waiting to be paid",
  in_transit: "On its way",
  completed: "Paid",
  failed: "Returned to your balance",
  cancelled: "Cancelled",
};

function parsePage(raw: string | string[] | undefined): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && /^\d{1,4}$/.test(v) ? Math.max(1, Number(v)) : 1;
}

export default async function EarningsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const googleId = (session.user as { googleId?: string }).googleId;

  const db = getDb();
  if (!db || !googleId) redirect("/dashboard");
  const [user] = await db<{
    id: number;
    handle: string | null;
    creator_status: string;
    onboarding_state: string;
    upi_vpa: string | null;
  }[]>`
    select id, handle, creator_status, onboarding_state, upi_vpa from users where google_id = ${googleId}
  `;
  // Nothing to show until the creator has a link.
  if (!user?.handle) redirect("/dashboard");

  const page = parsePage((await searchParams).page);
  const q = db as unknown as Query;
  let summary: EarningsSummary | null = null;
  let rows: StatementRow[] = [];
  let hasMore = false;
  try {
    summary = await loadEarningsSummary(q, user.id);
    const got = await loadStatement(q, user.id, STATEMENT_PAGE_SIZE + 1, (page - 1) * STATEMENT_PAGE_SIZE);
    rows = got.slice(0, STATEMENT_PAGE_SIZE);
    hasMore = got.length > STATEMENT_PAGE_SIZE;
  } catch {
    summary = null;
  }

  return (
    <DashboardShell handle={user.handle} live={user.creator_status === "active"}>
      <div className="mx-auto w-full max-w-2xl space-y-8 px-6 pb-24 pt-4">
        <div className="space-y-4">
          <DashboardNav current="earnings" />
          <h1 className="display text-[clamp(2.25rem,8vw,3.5rem)]">Earnings</h1>
        </div>

        {!summary ? (
          <p className="rounded-surface border border-line/60 bg-surface p-6 text-muted">
            We could not read your earnings just now. Please try again in a minute.
          </p>
        ) : (
          <>
            <Tiles summary={summary} />
            <Payout
              summary={summary}
              active={user.creator_status === "active" && user.onboarding_state === "active"}
              upiVpa={user.upi_vpa}
            />
            <Statement rows={rows} page={page} hasMore={hasMore} />
            <Payouts summary={summary} />
          </>
        )}

        <p className="text-sm text-muted">
          Only live tips that have been added to our books are listed; a tip appears here a short while
          after it is paid. Each row is worked at the rates the tip was made under. A tip stays pending
          for a waiting period before it can be paid out ({HOLD_DAYS_UPI} day for a UPI tip,{" "}
          {HOLD_DAYS_OTHER} days for any other method, {HOLD_DAYS_NEW_CREATOR} days for those while you
          have no completed payout). Every morning, if at least {formatRupees(MIN_PAYOUT_PAISE)} is
          available, a payout is started for you and paid by hand to your UPI ID; you don&apos;t need to
          ask. We do not promise a particular day. The first payout is at most{" "}
          {formatRupees(FIRST_PAYOUT_MAX_PAISE)} and any one payout at most {formatRupees(PAYOUT_MAX_PAISE)};
          the rest stays available for the next one.
        </p>
      </div>
    </DashboardShell>
  );
}

function Tiles({ summary }: { summary: EarningsSummary }) {
  return (
    <section aria-label="Your balance" className="grid gap-3 sm:grid-cols-3">
      <Tile label="Balance" value={formatRupees(summary.balancePaise)} note="Everything the books hold for you." accent />
      <Tile
        label="Pending"
        value={formatRupees(summary.pendingPaise)}
        note={
          summary.nextReleaseAt
            ? `Part of your balance. The first tip frees up on ${dateOnly.format(summary.nextReleaseAt)}.`
            : "Nothing is waiting."
        }
      />
      <Tile label="Paid out" value={formatRupees(summary.paidOutPaise)} note="Payouts that reached you." />
    </section>
  );
}

function Payout({ summary, active, upiVpa }: { summary: EarningsSummary; active: boolean; upiVpa: string | null }) {
  const open = summary.payouts.find((p) => p.status === "initiated" || p.status === "in_transit");
  const amount = amountToRequest(summary.availablePaise, summary.hasCompletedPayout);

  let body: React.ReactNode;
  if (open) {
    body = (
      <p className="text-text">
        A payout of <span className="numeric font-semibold">{formatRupees(open.amountPaise)}</span> (
        <span className="numeric">{payoutRef(open.id)}</span>) is on its way to your UPI ID. It will show
        here as Paid once it has been sent. The next one starts after that.
      </p>
    );
  } else if (!active) {
    body = <p className="text-muted">Payouts open once your account is active.</p>;
  } else if (!upiVpa) {
    body = <p className="text-muted">Add a UPI ID in your payout setup so we can pay you.</p>;
  } else if (amount > 0) {
    body = (
      <p className="text-text">
        <span className="numeric font-semibold">{formatRupees(amount)}</span> is ready. A payout to{" "}
        <span className="numeric">{upiVpa}</span> starts by itself at the next morning run (about 9 am);
        you don&apos;t need to do anything.
      </p>
    );
  } else {
    body = (
      <p className="text-muted">
        A payout starts by itself on the morning after at least {formatRupees(MIN_PAYOUT_PAISE)} is
        available. Available now: <span className="numeric text-text">{formatRupees(summary.availablePaise)}</span>
        {summary.pendingPaise > 0 ? ` (${formatRupees(summary.pendingPaise)} more is still pending).` : "."}
      </p>
    );
  }

  return (
    <section aria-labelledby="payout-title" className="space-y-3 rounded-surface border border-line/60 bg-surface p-5">
      <h2 id="payout-title" className="text-lg font-semibold text-text">
        Get paid
      </h2>
      {body}
    </section>
  );
}

function Tile({ label, value, note, accent }: { label: string; value: string; note: string; accent?: boolean }) {
  return (
    <div className="space-y-1 rounded-surface border border-line/60 bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className={`numeric text-2xl font-semibold ${accent ? "text-accent" : "text-text"}`}>{value}</p>
      <p className="text-sm text-muted">{note}</p>
    </div>
  );
}

function Statement({ rows, page, hasMore }: { rows: StatementRow[]; page: number; hasMore: boolean }) {
  return (
    <section aria-labelledby="statement-title" className="space-y-4">
      <h2 id="statement-title" className="text-lg font-semibold text-text">
        Statement
      </h2>
      {rows.length === 0 ? (
        <p className="rounded-surface border border-line/60 bg-surface p-6 text-muted">
          {page > 1 ? "No more tips here." : "No tips in your books yet. Each paid tip will appear here with its fees."}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.tipId} className="space-y-2 rounded-[var(--radius-surface)] border border-line/60 bg-surface p-5">
              <p className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 break-words font-medium text-text">{r.name}</span>
                <span className="numeric shrink-0 text-lg font-semibold text-text">{formatRupees(r.grossPaise)}</span>
              </p>
              <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm text-muted">
                <time dateTime={r.capturedAt.toISOString()}>{dateTime.format(r.capturedAt)}</time>
                <span>
                  {statusWord(r.status)}
                  {r.releasesAt ? ` until ${dateOnly.format(r.releasesAt)}` : ""}
                </span>
              </p>
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <Part label="Freetip fee" value={`−${formatRupees(r.platformFeePaise)}`} />
                <Part label="Processing" value={`−${formatRupees(r.processingPaise)}`} />
                <Part label="You keep" value={formatRupees(r.netPaise)} strong />
              </dl>
            </li>
          ))}
        </ul>
      )}

      {(page > 1 || hasMore) && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3">
          {page > 1 ? (
            <Link href={page === 2 ? "/dashboard/earnings" : `/dashboard/earnings?page=${page - 1}`} className={pill}>
              Newer
            </Link>
          ) : (
            <span />
          )}
          {hasMore && (
            <Link href={`/dashboard/earnings?page=${page + 1}`} className={pill}>
              Older
            </Link>
          )}
        </nav>
      )}

      {(rows.length > 0 || page > 1) && (
        <div className="space-y-2">
          <a href="/api/dashboard/earnings/export" download="earnings.csv" className={pill}>
            Download CSV
          </a>
          <p className="text-sm text-muted">Every tip in your statement, not just this page. Times are in IST.</p>
        </div>
      )}
    </section>
  );
}

const pill =
  "inline-flex h-11 items-center rounded-full border border-control px-5 text-sm text-text transition-colors hover:border-accent";

function Part({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className={`numeric ${strong ? "font-semibold text-text" : "text-text"}`}>{value}</dd>
    </div>
  );
}

function Payouts({ summary }: { summary: EarningsSummary }) {
  return (
    <section aria-labelledby="payouts-title" className="space-y-4">
      <h2 id="payouts-title" className="text-lg font-semibold text-text">
        Payout history
      </h2>
      {summary.payouts.length === 0 ? (
        <p className="rounded-surface border border-line/60 bg-surface p-6 text-muted">
          No payouts yet. Payouts will be listed here when they are made.
        </p>
      ) : (
        <ul className="space-y-3">
          {summary.payouts.map((p) => (
            <li
              key={p.id}
              className="flex items-baseline justify-between gap-3 rounded-[var(--radius-surface)] border border-line/60 bg-surface p-5"
            >
              <span className="text-sm text-muted">
                {dateOnly.format(p.at)} · {PAYOUT_WORDS[p.status] ?? p.status}
              </span>
              <span className="numeric text-lg font-semibold text-text">{formatRupees(p.amountPaise)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
