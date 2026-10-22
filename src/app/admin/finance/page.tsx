import { Suspense } from "react";
import { DateRangeNav } from "@/components/admin/DateRangeNav";
import { MetricCard, ExceptionCard } from "@/components/admin/MetricCard";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { getFinanceSummary, creatorNetMinor, pendingMinor, formatINR } from "@/lib/admin/finance-queries";
import { parsePreset, rangeFromPreset } from "@/lib/admin/date-range";
import { requireOwner } from "@/lib/owner-auth";

export const dynamic = "force-dynamic";

export default async function AdminFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requireOwner();
  const { range: rangeParam } = await searchParams;
  const preset = parsePreset(rangeParam);
  const range = rangeFromPreset(preset);
  const summary = await getFinanceSummary(range);

  const creatorNet = creatorNetMinor(summary);
  const pending = pendingMinor(summary);
  const hasData = summary.grossCapturedMinor > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          Finance
        </p>
        <h1 className="display text-[clamp(2rem,5vw,3.5rem)] leading-[0.95]">
          Money movement
        </h1>
      </div>

      {/* Date range */}
      <Suspense>
        <DateRangeNav current={preset} />
      </Suspense>

      {/* Data freshness */}
      <p className="text-xs text-muted">
        Data as of{" "}
        {summary.fetchedAt.toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          dateStyle: "medium",
          timeStyle: "short",
        })}{" "}
        IST
        {summary.lastReconciliationAt
          ? ` · Last reconciliation: ${summary.lastReconciliationAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST`
          : " · No reconciliation run yet"}
      </p>

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Gross captured"
          value={formatINR(summary.grossCapturedMinor)}
          accent={hasData}
        />
        <MetricCard
          label="Refunded"
          value={formatINR(summary.refundedProcessedMinor)}
          sub={
            summary.refundedPendingMinor > 0
              ? `+ ${formatINR(summary.refundedPendingMinor)} pending`
              : undefined
          }
        />
        <MetricCard
          label="Provider fees & taxes"
          value={formatINR(summary.providerFeesMinor)}
          note="Actual Razorpay charges — never estimated"
        />
        <MetricCard
          label="Platform fee revenue"
          value={formatINR(summary.platformFeeMinor)}
          note="5% of every captured tip"
        />
        <MetricCard
          label="Creator net payable"
          value={formatINR(creatorNet)}
          note="Gross − refunds − provider fees − platform fee"
        />
        <MetricCard
          label="Settled to creators"
          value={formatINR(summary.settledMinor)}
        />
        <MetricCard
          label="Pending / unsettled"
          value={formatINR(pending)}
          note="Captured but not yet settled or paid out"
        />
        <ExceptionCard
          exceptions={summary.openExceptions}
          disputes={summary.openDisputes}
        />
      </div>

      {/* Empty state when no data yet */}
      {!hasData && (
        <AdminEmptyState
          title="No captured payments in this period"
          description="Razorpay is not connected yet. Payment orders, verified captures, refunds, settlements and actual fee lines will populate these cards once the payment integration is live and tips are received."
        />
      )}

      {/* Placeholder for charts — will be built when data exists */}
      {hasData && (
        <div className="rounded-2xl border border-dashed border-control p-6 text-center text-sm text-muted">
          Charts (daily gross, refunds, platform fee, creator net) — coming next
        </div>
      )}
    </div>
  );
}
