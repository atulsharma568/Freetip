import { Suspense } from "react";
import { DateRangeNav } from "@/components/admin/DateRangeNav";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { getCreatorEarnings } from "@/lib/admin/creator-queries";
import { formatINR } from "@/lib/admin/finance-queries";
import { parsePreset, rangeFromPreset } from "@/lib/admin/date-range";

export const dynamic = "force-dynamic";

function fmt(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function CreatorEarningsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const preset = parsePreset(rangeParam);
  const range = rangeFromPreset(preset);
  const rows = await getCreatorEarnings(range);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          Finance · Creator earnings
        </p>
        <h1 className="display text-[clamp(2rem,5vw,3.5rem)] leading-[0.95]">
          Per-creator breakdown
        </h1>
      </div>

      <Suspense>
        <DateRangeNav current={preset} />
      </Suspense>

      {rows.length === 0 ? (
        <AdminEmptyState
          title="No creator earnings in this period"
          description="Creators with at least one captured tip will appear here once payment data exists. Amounts show gross tips, fees, net payable, settled and pending — all from real ledger records."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-control">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-control bg-surface/60">
                <th className="px-4 py-3 text-left font-medium text-muted">Creator</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Tips</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Gross</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Refunded</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Provider fees</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Platform fee</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Net payable</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Settled</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Pending</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Last tip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-control">
              {rows.map((r) => (
                <tr key={r.creatorId} className="hover:bg-surface/40 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-text">
                      {r.name ?? "—"}
                    </p>
                    {r.handle && (
                      <p className="text-xs text-muted">@{r.handle}</p>
                    )}
                    {r.ytChannelName && (
                      <p className="text-xs text-muted/60">{r.ytChannelName}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-text">
                    {r.tipCount}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-accent">
                    {formatINR(r.grossMinor)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-text">
                    {r.refundedMinor > 0 ? formatINR(r.refundedMinor) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-text">
                    {r.providerFeesMinor > 0 ? formatINR(r.providerFeesMinor) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-text">
                    {r.platformFeeMinor > 0 ? formatINR(r.platformFeeMinor) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-text">
                    {formatINR(r.creatorNetMinor)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-text">
                    {r.settledMinor > 0 ? formatINR(r.settledMinor) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-text">
                    {r.pendingMinor > 0 ? formatINR(r.pendingMinor) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-muted">
                    {fmt(r.lastTipAt)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-control bg-surface/60">
                <td className="px-4 py-3 text-sm font-medium text-muted">
                  {rows.length} creator{rows.length !== 1 ? "s" : ""}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-text">
                  {rows.reduce((s, r) => s + r.tipCount, 0)}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-accent">
                  {formatINR(rows.reduce((s, r) => s + r.grossMinor, 0))}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-text">
                  {formatINR(rows.reduce((s, r) => s + r.refundedMinor, 0))}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-text">
                  {formatINR(rows.reduce((s, r) => s + r.providerFeesMinor, 0))}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-text">
                  {formatINR(rows.reduce((s, r) => s + r.platformFeeMinor, 0))}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-text">
                  {formatINR(rows.reduce((s, r) => s + r.creatorNetMinor, 0))}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-text">
                  {formatINR(rows.reduce((s, r) => s + r.settledMinor, 0))}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-text">
                  {formatINR(rows.reduce((s, r) => s + r.pendingMinor, 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
