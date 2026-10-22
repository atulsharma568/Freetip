import "server-only";
import { getDb } from "@/lib/db";
import type { DateRange } from "./date-range";

export type PaymentRow = {
  orderId: number;
  publicRef: string;
  creatorName: string | null;
  creatorHandle: string | null;
  grossMinor: number;
  currency: string;
  orderStatus: string;
  capturedAt: Date | null;
  createdAt: Date;
  providerPaymentRef: string | null;
  providerOrderRef: string | null;
  paymentMethod: string | null;
  providerStatus: string | null;
  platformFeeMinor: number;
  providerFeeMinor: number;
  creatorNetMinor: number;
  refundStatus: string | null;
  refundedMinor: number;
  payoutStatus: string | null;
  disputeStatus: string | null;
};

export async function getPayments(
  range: DateRange,
  limit = 200,
): Promise<PaymentRow[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const rows = await db<{
      order_id: string;
      public_reference: string;
      creator_name: string | null;
      creator_handle: string | null;
      gross_amount_minor: string;
      currency: string;
      order_status: string;
      captured_at: Date | null;
      created_at: Date;
      provider_payment_ref: string | null;
      provider_order_ref: string | null;
      payment_method: string | null;
      provider_status: string | null;
      platform_fee_minor: string;
      provider_fee_minor: string;
      refund_status: string | null;
      refunded_minor: string;
      payout_status: string | null;
      dispute_status: string | null;
    }[]>`
      select
        o.id                                                            as order_id,
        o.public_reference,
        u.name                                                          as creator_name,
        u.handle                                                        as creator_handle,
        o.gross_amount_minor::text,
        o.currency,
        o.status                                                        as order_status,
        o.captured_at,
        o.created_at,
        pa.provider_payment_ref,
        pa.provider_order_ref,
        pa.payment_method,
        pa.provider_status,
        coalesce(f.platform_fee_minor, 0)::text                        as platform_fee_minor,
        coalesce(f.provider_fee_minor, 0)::text                        as provider_fee_minor,
        coalesce(rf.refund_status, null)                               as refund_status,
        coalesce(rf.refunded_minor, 0)::text                           as refunded_minor,
        cp.status                                                       as payout_status,
        d.status                                                        as dispute_status
      from tip_orders o
      join users u on u.id = o.creator_id
      left join lateral (
        select provider_payment_ref, provider_order_ref, payment_method, provider_status
        from payment_attempts
        where tip_order_id = o.id
        order by created_at desc
        limit 1
      ) pa on true
      left join lateral (
        select
          sum(case when fee_type = 'platform_fee' then amount_minor else 0 end) as platform_fee_minor,
          sum(case when fee_type in ('gateway_fee','gateway_tax','upi_mdr') then amount_minor else 0 end) as provider_fee_minor
        from fee_lines
        where tip_order_id = o.id
      ) f on true
      left join lateral (
        select status as refund_status, sum(processed_amount_minor) as refunded_minor
        from refunds
        where tip_order_id = o.id
        group by status
        order by case status
          when 'processing' then 1 when 'requested' then 2
          when 'approved' then 3 when 'processed' then 4 else 5
        end
        limit 1
      ) rf on true
      left join lateral (
        select status
        from creator_payouts
        where creator_id = o.creator_id
          and status in ('completed','in_transit','initiated')
        order by created_at desc
        limit 1
      ) cp on true
      left join lateral (
        select status
        from disputes
        where tip_order_id = o.id
          and status not in ('won','closed')
        limit 1
      ) d on true
      where o.created_at >= ${range.from}
        and o.created_at < ${range.to}
      order by o.created_at desc
      limit ${limit}
    `;

    return rows.map((r) => {
      const gross = Number(r.gross_amount_minor);
      const platformFee = Number(r.platform_fee_minor);
      const providerFee = Number(r.provider_fee_minor);
      const refunded = Number(r.refunded_minor);
      return {
        orderId: Number(r.order_id),
        publicRef: r.public_reference,
        creatorName: r.creator_name,
        creatorHandle: r.creator_handle,
        grossMinor: gross,
        currency: r.currency,
        orderStatus: r.order_status,
        capturedAt: r.captured_at,
        createdAt: r.created_at,
        providerPaymentRef: r.provider_payment_ref,
        providerOrderRef: r.provider_order_ref,
        paymentMethod: r.payment_method,
        providerStatus: r.provider_status,
        platformFeeMinor: platformFee,
        providerFeeMinor: providerFee,
        creatorNetMinor: Math.max(0, gross - refunded - providerFee - platformFee),
        refundStatus: r.refund_status,
        refundedMinor: refunded,
        payoutStatus: r.payout_status,
        disputeStatus: r.dispute_status,
      };
    });
  } catch {
    return [];
  }
}

export type SettlementRow = {
  settlementId: number;
  providerRef: string;
  settledAt: Date | null;
  expectedAt: Date | null;
  grossMinor: number;
  feesMinor: number;
  taxesMinor: number;
  netMinor: number;
  currency: string;
  status: string;
  paymentCount: number;
};

export async function getSettlements(
  range: DateRange,
): Promise<SettlementRow[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const rows = await db<{
      settlement_id: string;
      provider_ref: string;
      settled_at: Date | null;
      expected_at: Date | null;
      settlement_amount_minor: string;
      fees_minor: string;
      taxes_minor: string;
      net_amount_minor: string;
      currency: string;
      status: string;
      payment_count: string;
    }[]>`
      select
        s.id::text                          as settlement_id,
        s.provider_ref,
        s.settled_at,
        s.expected_at,
        s.settlement_amount_minor::text,
        s.fees_minor::text,
        s.taxes_minor::text,
        s.net_amount_minor::text,
        s.currency,
        s.status,
        coalesce(si.payment_count, 0)::text as payment_count
      from settlements s
      left join (
        select settlement_id, count(*) as payment_count
        from settlement_items
        group by settlement_id
      ) si on si.settlement_id = s.id
      where s.created_at >= ${range.from}
        and s.created_at < ${range.to}
      order by coalesce(s.settled_at, s.expected_at) desc
    `;

    return rows.map((r) => ({
      settlementId: Number(r.settlement_id),
      providerRef: r.provider_ref,
      settledAt: r.settled_at,
      expectedAt: r.expected_at,
      grossMinor: Number(r.settlement_amount_minor),
      feesMinor: Number(r.fees_minor),
      taxesMinor: Number(r.taxes_minor),
      netMinor: Number(r.net_amount_minor),
      currency: r.currency,
      status: r.status,
      paymentCount: Number(r.payment_count),
    }));
  } catch {
    return [];
  }
}

export type ReconciliationSummary = {
  totalRuns: number;
  lastRunAt: Date | null;
  openExceptions: number;
  partialMatches: number;
  recentItems: {
    itemId: number;
    internalRef: string | null;
    providerRef: string | null;
    matchState: string;
    exceptionReason: string | null;
    expectedMinor: number | null;
    observedMinor: number | null;
    currency: string;
  }[];
};

export async function getReconciliationSummary(): Promise<ReconciliationSummary> {
  const db = getDb();
  if (!db)
    return { totalRuns: 0, lastRunAt: null, openExceptions: 0, partialMatches: 0, recentItems: [] };

  try {
    const [runsRow, exceptionsRow, itemsRows] = await Promise.all([
      db<{ total: string; last_run: Date | null }[]>`
        select count(*)::text as total, max(completed_at) as last_run
        from reconciliation_runs
        where status = 'completed'
      `,
      db<{ open_exceptions: string; partial_matches: string }[]>`
        select
          sum(case when match_state = 'exception' then 1 else 0 end)::text as open_exceptions,
          sum(case when match_state = 'partial' then 1 else 0 end)::text   as partial_matches
        from reconciliation_items
        where resolved_at is null
      `,
      db<{
        id: string;
        internal_ref: string | null;
        provider_ref: string | null;
        match_state: string;
        exception_reason: string | null;
        expected_amount_minor: string | null;
        observed_amount_minor: string | null;
        currency: string;
      }[]>`
        select
          ri.id::text,
          ri.internal_ref,
          ri.provider_ref,
          ri.match_state,
          ri.exception_reason,
          ri.expected_amount_minor::text,
          ri.observed_amount_minor::text,
          ri.currency
        from reconciliation_items ri
        join reconciliation_runs rr on rr.id = ri.run_id
        where ri.match_state in ('exception', 'unmatched', 'partial')
          and ri.resolved_at is null
        order by rr.started_at desc
        limit 50
      `,
    ]);

    return {
      totalRuns: Number(runsRow[0]?.total ?? 0),
      lastRunAt: runsRow[0]?.last_run ?? null,
      openExceptions: Number(exceptionsRow[0]?.open_exceptions ?? 0),
      partialMatches: Number(exceptionsRow[0]?.partial_matches ?? 0),
      recentItems: itemsRows.map((r) => ({
        itemId: Number(r.id),
        internalRef: r.internal_ref,
        providerRef: r.provider_ref,
        matchState: r.match_state,
        exceptionReason: r.exception_reason,
        expectedMinor: r.expected_amount_minor != null ? Number(r.expected_amount_minor) : null,
        observedMinor: r.observed_amount_minor != null ? Number(r.observed_amount_minor) : null,
        currency: r.currency,
      })),
    };
  } catch {
    return { totalRuns: 0, lastRunAt: null, openExceptions: 0, partialMatches: 0, recentItems: [] };
  }
}
