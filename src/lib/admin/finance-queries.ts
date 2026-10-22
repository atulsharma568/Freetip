import "server-only";
import { getDb } from "@/lib/db";
import type { DateRange } from "./date-range";

export type FinanceSummary = {
  grossCapturedMinor: number;
  refundedProcessedMinor: number;
  refundedPendingMinor: number;
  providerFeesMinor: number;
  platformFeeMinor: number;
  settledMinor: number;
  openExceptions: number;
  openDisputes: number;
  lastReconciliationAt: Date | null;
  fetchedAt: Date;
};

const ZERO: FinanceSummary = {
  grossCapturedMinor: 0,
  refundedProcessedMinor: 0,
  refundedPendingMinor: 0,
  providerFeesMinor: 0,
  platformFeeMinor: 0,
  settledMinor: 0,
  openExceptions: 0,
  openDisputes: 0,
  lastReconciliationAt: null,
  fetchedAt: new Date(),
};

export async function getFinanceSummary(range: DateRange): Promise<FinanceSummary> {
  const db = getDb();
  if (!db) return { ...ZERO, fetchedAt: new Date() };

  try {
    const [
      grossRow,
      refundRow,
      feeRow,
      platformRow,
      settledRow,
      exceptionRow,
      disputeRow,
      reconcRow,
    ] = await Promise.all([
      // Gross captured in period
      db<{ total: string }[]>`
        select coalesce(sum(gross_amount_minor), 0)::text as total
        from tip_orders
        where status = 'captured'
          and captured_at >= ${range.from}
          and captured_at < ${range.to}
      `,
      // Refunds: processed and pending separately
      db<{ processed: string; pending: string }[]>`
        select
          coalesce(sum(case when status = 'processed' then processed_amount_minor else 0 end), 0)::text as processed,
          coalesce(sum(case when status in ('requested','approved','processing') then requested_amount_minor else 0 end), 0)::text as pending
        from refunds
        where requested_at >= ${range.from}
          and requested_at < ${range.to}
      `,
      // Provider fees (gateway + tax + UPI MDR)
      db<{ total: string }[]>`
        select coalesce(sum(amount_minor), 0)::text as total
        from fee_lines
        where fee_type in ('gateway_fee', 'gateway_tax', 'upi_mdr')
          and effective_at >= ${range.from}
          and effective_at < ${range.to}
      `,
      // Platform fee revenue
      db<{ total: string }[]>`
        select coalesce(sum(amount_minor), 0)::text as total
        from fee_lines
        where fee_type = 'platform_fee'
          and effective_at >= ${range.from}
          and effective_at < ${range.to}
      `,
      // Settled to creators
      db<{ total: string }[]>`
        select coalesce(sum(amount_minor), 0)::text as total
        from creator_payouts
        where status = 'completed'
          and completed_at >= ${range.from}
          and completed_at < ${range.to}
      `,
      // Open reconciliation exceptions (not date-scoped — all open items)
      db<{ count: string }[]>`
        select count(*)::text as count
        from reconciliation_items
        where match_state in ('unmatched', 'exception')
          and resolved_at is null
      `,
      // Open disputes
      db<{ count: string }[]>`
        select count(*)::text as count
        from disputes
        where status in ('open', 'under_review', 'evidence_due')
      `,
      // Last completed reconciliation run
      db<{ completed_at: Date | null }[]>`
        select max(completed_at) as completed_at
        from reconciliation_runs
        where status = 'completed'
      `,
    ]);

    return {
      grossCapturedMinor: Number(grossRow[0]?.total ?? 0),
      refundedProcessedMinor: Number(refundRow[0]?.processed ?? 0),
      refundedPendingMinor: Number(refundRow[0]?.pending ?? 0),
      providerFeesMinor: Number(feeRow[0]?.total ?? 0),
      platformFeeMinor: Number(platformRow[0]?.total ?? 0),
      settledMinor: Number(settledRow[0]?.total ?? 0),
      openExceptions: Number(exceptionRow[0]?.count ?? 0),
      openDisputes: Number(disputeRow[0]?.count ?? 0),
      lastReconciliationAt: reconcRow[0]?.completed_at ?? null,
      fetchedAt: new Date(),
    };
  } catch {
    // Tables not migrated yet or DB unavailable — return zeros.
    return { ...ZERO, fetchedAt: new Date() };
  }
}

// Derived: creator net payable = gross - processed refunds - provider fees - platform fee
export function creatorNetMinor(s: FinanceSummary): number {
  return Math.max(
    0,
    s.grossCapturedMinor -
      s.refundedProcessedMinor -
      s.providerFeesMinor -
      s.platformFeeMinor,
  );
}

// Derived: pending/unsettled = gross - processed refunds - settled
export function pendingMinor(s: FinanceSummary): number {
  return Math.max(0, s.grossCapturedMinor - s.refundedProcessedMinor - s.settledMinor);
}

export function formatINR(minor: number): string {
  const rupees = minor / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}
