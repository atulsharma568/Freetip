import { Suspense } from "react";
import { DateRangeNav } from "@/components/admin/DateRangeNav";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { getSettlements } from "@/lib/admin/payment-queries";
import { formatINR } from "@/lib/admin/finance-queries";
import { parsePreset, rangeFromPreset } from "@/lib/admin/date-range";

export const dynamic = "force-dynamic";

function fmtDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const preset = parsePreset(rangeParam);
  const range = rangeFromPreset(preset);
  const rows = await getSettlements(range);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          Finance · Settlements
        </p>
        <h1 className="display text-[clamp(2rem,5vw,3.5rem)] leading-[0.95]">
          Razorpay settlements
        </h1>
        <p className="max-w-xl text-sm text-muted">
          Razorpay settlements are separate from creator payouts. A settlement is money
          arriving in Tipsite&apos;s bank account; a payout is Tipsite transferring the
          creator&apos;s share to them.
        </p>
      </div>

      <Suspense>
        <DateRangeNav current={preset} />
      </Suspense>

      {rows.length === 0 ? (
        <AdminEmptyState
          title="No settlement batches in this period"
          description="Razorpay settlement batches will appear here once the payment integration is live and the first settlement cycle completes. Each batch shows gross received, provider fees and taxes, net amount and the number of included payments."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-control">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-control bg-surface/60">
                <th className="px-4 py-3 text-left font-medium text-muted">Settlement ID</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Payments</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Gross</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Provider fees</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Taxes</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Net received</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Settled</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Expected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-control">
              {rows.map((r) => (
                <tr key={r.settlementId} className="hover:bg-surface/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {r.providerRef}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-text">
                    {r.paymentCount > 0 ? r.paymentCount : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-accent">
                    {formatINR(r.grossMinor)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-text">
                    {r.feesMinor > 0 ? formatINR(r.feesMinor) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-text">
                    {r.taxesMinor > 0 ? formatINR(r.taxesMinor) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-text">
                    {formatINR(r.netMinor)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-muted">
                    {fmtDate(r.settledAt)}
                  </td>
                  <td className="px-4 py-3 text-right text-muted">
                    {fmtDate(r.expectedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-control bg-surface/60">
                <td className="px-4 py-3 text-sm font-medium text-muted">
                  {rows.length} batch{rows.length !== 1 ? "es" : ""}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-text">
                  {rows.reduce((s, r) => s + r.paymentCount, 0)}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-accent">
                  {formatINR(rows.reduce((s, r) => s + r.grossMinor, 0))}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-text">
                  {formatINR(rows.reduce((s, r) => s + r.feesMinor, 0))}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-text">
                  {formatINR(rows.reduce((s, r) => s + r.taxesMinor, 0))}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-text">
                  {formatINR(rows.reduce((s, r) => s + r.netMinor, 0))}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
