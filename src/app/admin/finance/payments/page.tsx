import { Suspense } from "react";
import { DateRangeNav } from "@/components/admin/DateRangeNav";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { getPayments } from "@/lib/admin/payment-queries";
import { formatINR } from "@/lib/admin/finance-queries";
import { parsePreset, rangeFromPreset } from "@/lib/admin/date-range";
import { requireOwner } from "@/lib/owner-auth";

export const dynamic = "force-dynamic";

function fmtTs(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function PaymentLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requireOwner();
  const { range: rangeParam } = await searchParams;
  const preset = parsePreset(rangeParam);
  const range = rangeFromPreset(preset);
  const rows = await getPayments(range);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          Finance · Payment ledger
        </p>
        <h1 className="display text-[clamp(2rem,5vw,3.5rem)] leading-[0.95]">
          All payments
        </h1>
        {rows.length > 0 && (
          <p className="text-sm text-muted">
            {rows.length} order{rows.length !== 1 ? "s" : ""} · most recent first · capped at 200
          </p>
        )}
      </div>

      <Suspense>
        <DateRangeNav current={preset} />
      </Suspense>

      {rows.length === 0 ? (
        <AdminEmptyState
          title="No payment orders in this period"
          description="Every tip order will appear here once the payment integration is live. Each row is traceable to its provider identifiers, fee lines and creator allocation."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-control">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-control bg-surface/60">
                <th className="px-4 py-3 text-left font-medium text-muted">Order</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Creator</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Gross</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Method</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Platform fee</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Provider fee</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Creator net</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Flags</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Captured</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-control">
              {rows.map((r) => (
                <tr key={r.orderId} className="hover:bg-surface/40 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs text-muted">{r.publicRef}</p>
                    {r.providerPaymentRef && (
                      <p className="font-mono text-xs text-muted/60">{r.providerPaymentRef}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-text">{r.creatorName ?? "—"}</p>
                    {r.creatorHandle && (
                      <p className="text-xs text-muted">@{r.creatorHandle}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-accent">
                    {formatINR(r.grossMinor)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.orderStatus} />
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {r.paymentMethod ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-text">
                    {r.platformFeeMinor > 0 ? formatINR(r.platformFeeMinor) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-text">
                    {r.providerFeeMinor > 0 ? formatINR(r.providerFeeMinor) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-text">
                    {formatINR(r.creatorNetMinor)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.refundStatus && <StatusBadge status={r.refundStatus} />}
                      {r.disputeStatus && <StatusBadge status={r.disputeStatus} />}
                      {r.payoutStatus && <StatusBadge status={r.payoutStatus} />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-muted">
                    {fmtTs(r.capturedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
