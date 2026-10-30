import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { MetricCard } from "@/components/admin/MetricCard";
import { findUnpostableCaptures, type UnpostableCapture } from "@/lib/accrual";
import { formatINR, getNotPosted, type NotPosted } from "@/lib/admin/finance-queries";
import { getReconciliationSummary, type ReconciliationSummary } from "@/lib/admin/payment-queries";
import { load, type Loaded } from "@/lib/admin/result";
import { adminDb } from "@/lib/admin/server-db";
import { requireOwner } from "@/lib/owner-auth";
import { CouldNotRead, DefinitionNote, FinanceNotSetUp } from "../_components/Notices";
import { SyncBooksForm } from "./SyncBooksForm";

export const dynamic = "force-dynamic";

function fmtTs(date: Date | null, never = "Never"): string {
  if (!date) return never;
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold text-text">{children}</h2>;
}

export default async function AdminReconciliationPage() {
  await requireOwner();
  const db = adminDb();

  const header = (
    <div className="space-y-1">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Reconciliation</p>
      <h1 className="display text-[clamp(2rem,5vw,3.5rem)] leading-[0.95]">Provider vs ledger</h1>
      <DefinitionNote>
        Live Razorpay payments only; test-mode payments are never posted and never listed here.
        Nothing on this page changes the books until you press a button.
      </DefinitionNote>
    </div>
  );

  if (!db) {
    return (
      <div className="space-y-8">
        {header}
        <FinanceNotSetUp />
      </div>
    );
  }

  const [notPosted, unpostable, summary] = await Promise.all([
    getNotPosted(db),
    load("tips that cannot be posted", () => findUnpostableCaptures(db)),
    getReconciliationSummary(db),
  ]);

  return (
    <div className="space-y-10">
      {header}

      <section className="space-y-4">
        <Heading>Captured tips not yet posted to the books</Heading>
        <NotPostedBlock notPosted={notPosted} />
      </section>

      <section className="space-y-4">
        <Heading>Tips that cannot be posted automatically</Heading>
        <UnpostableBlock unpostable={unpostable} />
      </section>

      <section className="space-y-4">
        <Heading>Sync with Razorpay</Heading>
        <p className="max-w-2xl text-sm text-muted">
          Does what the daily job does, now: asks Razorpay for its live payments of the last 3 days,
          lists any the site never recorded, fills in the live-mode flag and captured amount for payments
          the site did capture but did not finish saving, then posts every captured live tip that is not
          on the books. It only works with live keys (the posting still runs without them). It runs
          only when you press the button.
        </p>
        <SyncBooksForm />
      </section>

      <section className="space-y-4">
        <Heading>Reconciliation runs against Razorpay&apos;s reports</Heading>
        <RunsBlock summary={summary} />
      </section>
    </div>
  );
}

function NotPostedBlock({ notPosted }: { notPosted: Loaded<NotPosted> }) {
  if (!notPosted.ok) return <CouldNotRead detail={notPosted.error} />;
  const n = notPosted.data;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Not yet posted"
          value={String(n.count)}
          sub={formatINR(n.grossMinor)}
          accent={n.count > 0}
          note="Captured live tips with no ledger posting"
        />
        <MetricCard
          label="Can be posted now"
          value={String(n.postableCount)}
          note="The amounts agree with Razorpay"
        />
        <MetricCard
          label="Need a person to look"
          value={String(n.needsLookCount)}
          accent={n.needsLookCount > 0}
          note="Listed below"
        />
      </div>
      <p className="max-w-2xl text-sm text-muted">
        {n.count === 0
          ? "Every captured live tip is on the ledger."
          : "The site posts a tip right after Razorpay confirms it, and a daily job posts any that were missed. The Sync button below runs that job now."}
      </p>
    </>
  );
}

const UNPOSTABLE_WORDS: Record<UnpostableCapture["reason"], string> = {
  no_captured_facts: "Razorpay's captured amount or currency was never saved for this payment.",
  amount_mismatch:
    "Razorpay's captured amount or currency does not match the order, or the order's own amounts disagree.",
};

function UnpostableBlock({ unpostable }: { unpostable: Loaded<UnpostableCapture[]> }) {
  if (!unpostable.ok) return <CouldNotRead detail={unpostable.error} />;
  if (unpostable.data.length === 0) {
    return <p className="text-sm text-muted">None. Every captured live tip can be posted.</p>;
  }
  return (
    <div className="space-y-3">
      <p className="max-w-2xl text-sm text-muted">
        These are not posted automatically. If Razorpay&apos;s captured amount is simply missing, Sync
        fills it in from Razorpay when live keys are set and the tip is then posted. A real mismatch
        needs a person: check the payment in the Razorpay dashboard and decide what to do.
      </p>
      <div className="overflow-x-auto rounded-2xl border border-control">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-control bg-surface/60">
              <th className="px-4 py-3 text-left font-medium text-muted">Razorpay payment</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Tip</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Problem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-control">
            {unpostable.data.map((u) => (
              <tr key={u.paymentRef} className="hover:bg-surface/40 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-text">{u.paymentRef}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted">#{u.tipId}</td>
                <td className="px-4 py-3 text-sm text-text">{UNPOSTABLE_WORDS[u.reason]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {unpostable.data.length >= 50 && (
        <p className="text-xs text-muted">Only the first 50 are listed.</p>
      )}
    </div>
  );
}

function RunsBlock({ summary }: { summary: Loaded<ReconciliationSummary> }) {
  if (!summary.ok) return <CouldNotRead detail={summary.error} />;
  const s = summary.data;
  const hasIssues = s.openExceptions + s.partialMatches > 0;

  if (s.totalRuns === 0 && s.recentItems.length === 0) {
    return (
      <AdminEmptyState
        title="No reconciliation runs yet"
        description="Comparing Razorpay's settlement reports with the ledger is not built yet, so nothing is recorded here. The checks above are the ones that run today."
      />
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Completed runs"
          value={String(s.totalRuns)}
          note={`Last: ${fmtTs(s.lastRunAt)} IST`}
        />
        <MetricCard
          label="Open exceptions"
          value={String(s.openExceptions)}
          accent={s.openExceptions > 0}
        />
        <MetricCard
          label="Partial matches"
          value={String(s.partialMatches)}
          accent={s.partialMatches > 0}
        />
      </div>

      {!hasIssues ? (
        <div className="rounded-2xl border border-accent/20 bg-surface/60 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">All clear</p>
          <p className="mt-2 text-muted">No open exceptions or partial matches.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-control">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-control bg-surface/60">
                <th className="px-4 py-3 text-left font-medium text-muted">State</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Internal ref</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Provider ref</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Expected</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Observed</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Variance</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-control">
              {s.recentItems.map((item) => {
                const variance =
                  item.expectedMinor != null && item.observedMinor != null
                    ? item.observedMinor - item.expectedMinor
                    : null;
                return (
                  <tr key={item.itemId} className="hover:bg-surface/40 transition-colors">
                    <td className="px-4 py-3">
                      <StatusBadge status={item.matchState} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">{item.internalRef ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">{item.providerRef ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-text">
                      {item.expectedMinor != null ? formatINR(item.expectedMinor) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-text">
                      {item.observedMinor != null ? formatINR(item.observedMinor) : "—"}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono tabular-nums ${variance != null && variance !== 0 ? "text-red-400" : "text-muted"}`}
                    >
                      {variance != null
                        ? `${variance >= 0 ? "+" : "-"}${formatINR(Math.abs(variance))}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{item.exceptionReason ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
