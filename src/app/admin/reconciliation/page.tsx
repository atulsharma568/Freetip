import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { MetricCard } from "@/components/admin/MetricCard";
import { getReconciliationSummary } from "@/lib/admin/payment-queries";
import { formatINR } from "@/lib/admin/finance-queries";

export const dynamic = "force-dynamic";

function fmtTs(date: Date | null): string {
  if (!date) return "Never";
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function AdminReconciliationPage() {
  const summary = await getReconciliationSummary();
  const hasIssues = summary.openExceptions + summary.partialMatches > 0;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          Reconciliation
        </p>
        <h1 className="display text-[clamp(2rem,5vw,3.5rem)] leading-[0.95]">
          Provider vs ledger
        </h1>
        <p className="max-w-xl text-sm text-muted">
          Reconciliation compares Razorpay records with internal ledger entries.
          Every mismatch is an exception that must be resolved before payouts run.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Completed runs"
          value={String(summary.totalRuns)}
          note={`Last: ${fmtTs(summary.lastRunAt)} IST`}
        />
        <MetricCard
          label="Open exceptions"
          value={String(summary.openExceptions)}
          accent={summary.openExceptions > 0}
        />
        <MetricCard
          label="Partial matches"
          value={String(summary.partialMatches)}
          accent={summary.partialMatches > 0}
        />
      </div>

      {summary.totalRuns === 0 ? (
        <AdminEmptyState
          title="No reconciliation runs yet"
          description="Reconciliation runs will appear here once the Razorpay webhook source, reporting timezone, settlement cutoff and variance policy are confirmed. The first run compares provider payment and settlement totals against internal ledger entries."
        />
      ) : !hasIssues ? (
        <div className="rounded-2xl border border-accent/20 bg-surface/60 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">All clear</p>
          <p className="mt-2 text-muted">No open exceptions or partial matches.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-text">Open items</h2>
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
                {summary.recentItems.map((item) => {
                  const variance =
                    item.expectedMinor != null && item.observedMinor != null
                      ? item.observedMinor - item.expectedMinor
                      : null;
                  return (
                    <tr key={item.itemId} className="hover:bg-surface/40 transition-colors">
                      <td className="px-4 py-3">
                        <StatusBadge status={item.matchState} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">
                        {item.internalRef ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">
                        {item.providerRef ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-text">
                        {item.expectedMinor != null ? formatINR(item.expectedMinor) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-text">
                        {item.observedMinor != null ? formatINR(item.observedMinor) : "—"}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono tabular-nums ${variance != null && variance !== 0 ? "text-red-400" : "text-muted"}`}>
                        {variance != null
                          ? `${variance >= 0 ? "+" : ""}${formatINR(Math.abs(variance))}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {item.exceptionReason ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
