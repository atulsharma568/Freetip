import type { LedgerDb } from "../accrual";
import type { DateRange } from "./date-range";
import { load, toWhole, type Loaded } from "./result";

// The payments list, settlements and the older reconciliation summary. Live money
// only counts (see finance-queries.ts): a payment made in test mode, or before the
// mode was recorded, is listed as "Test" and left out of every total.

export interface PaymentRow {
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
  // false = test-mode (or the mode was never recorded)
  live: boolean;
  // Accrued fee lines (source 'accrual'); 0 until the tip is posted.
  ourFeeMinor: number;
  processingChargeMinor: number;
  // creator_payable credit minus debit for this tip, from the ledger.
  creatorShareMinor: number;
  // A `capture:<payment id>` ledger transaction exists.
  posted: boolean;
  refundStatus: string | null;
  disputeStatus: string | null;
}

export interface PaymentTotals {
  // Live, captured tips among the rows listed. Test rows and orders that were
  // never captured are not in these figures.
  tipCount: number;
  grossMinor: number;
  ourFeeMinor: number;
  processingChargeMinor: number;
  creatorShareMinor: number;
}

export interface PaymentList {
  rows: PaymentRow[];
  totals: PaymentTotals;
  // More orders exist in the period than were listed.
  truncated: boolean;
}

export function getPayments(
  db: LedgerDb,
  range: DateRange,
  limit = 200,
): Promise<Loaded<PaymentList>> {
  return load("the payments list", async () => {
    const from = range.from.toISOString();
    const to = range.to.toISOString();

    const found = await db<{
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
      live: boolean;
      our_fee_minor: string;
      processing_minor: string;
      share_minor: string;
      posted: boolean;
      refund_status: string | null;
      dispute_status: string | null;
    }[]>`
      select o.id::text                                     as order_id,
             o.public_reference,
             u.name                                         as creator_name,
             u.handle                                       as creator_handle,
             o.gross_amount_minor::text                     as gross_amount_minor,
             o.currency,
             o.status                                       as order_status,
             o.captured_at,
             o.created_at,
             pa.provider_payment_ref,
             pa.provider_order_ref,
             pa.payment_method,
             pa.provider_status,
             (pa.livemode is true)                          as live,
             coalesce(f.our_fee, 0)::text                   as our_fee_minor,
             coalesce(f.processing, 0)::text                as processing_minor,
             coalesce(sh.share, 0)::text                    as share_minor,
             exists (
               select 1 from ledger_transactions lt
                where lt.idempotency_key = 'capture:' || pa.provider_payment_ref
             )                                              as posted,
             rf.status                                      as refund_status,
             d.status                                       as dispute_status
        from tip_orders o
        join users u on u.id = o.creator_id
        left join lateral (
          select provider_payment_ref, provider_order_ref, payment_method, provider_status, livemode
            from payment_attempts
           where tip_order_id = o.id
           order by created_at desc, id desc
           limit 1
        ) pa on true
        left join lateral (
          select sum(case when fee_type = 'platform_fee' then amount_minor else 0 end) as our_fee,
                 sum(case when fee_type = 'gateway_fee'  then amount_minor else 0 end) as processing
            from fee_lines
           where tip_order_id = o.id and source = 'accrual'
        ) f on true
        left join lateral (
          select sum(e.credit_minor - e.debit_minor) as share
            from ledger_transactions lt
            join ledger_entries e   on e.ledger_transaction_id = lt.id
            join ledger_accounts a  on a.id = e.account_id and a.code = 'creator_payable'
           where lt.source_type = 'tip_order' and lt.source_ref = o.id::text
        ) sh on true
        left join lateral (
          select status from refunds where tip_order_id = o.id order by requested_at desc limit 1
        ) rf on true
        left join lateral (
          select status from disputes
           where tip_order_id = o.id and status not in ('won', 'closed')
           limit 1
        ) d on true
       where o.created_at >= ${from}::timestamptz
         and o.created_at <  ${to}::timestamptz
       order by o.created_at desc, o.id desc
       limit ${limit + 1}
    `;

    const truncated = found.length > limit;
    const rows: PaymentRow[] = found.slice(0, limit).map((r) => ({
      orderId: toWhole(r.order_id),
      publicRef: r.public_reference,
      creatorName: r.creator_name,
      creatorHandle: r.creator_handle,
      grossMinor: toWhole(r.gross_amount_minor),
      currency: r.currency,
      orderStatus: r.order_status,
      capturedAt: r.captured_at,
      createdAt: r.created_at,
      providerPaymentRef: r.provider_payment_ref,
      providerOrderRef: r.provider_order_ref,
      paymentMethod: r.payment_method,
      providerStatus: r.provider_status,
      live: r.live === true,
      ourFeeMinor: toWhole(r.our_fee_minor),
      processingChargeMinor: toWhole(r.processing_minor),
      creatorShareMinor: toWhole(r.share_minor),
      posted: r.posted === true,
      refundStatus: r.refund_status,
      disputeStatus: r.dispute_status,
    }));

    const totals: PaymentTotals = {
      tipCount: 0,
      grossMinor: 0,
      ourFeeMinor: 0,
      processingChargeMinor: 0,
      creatorShareMinor: 0,
    };
    for (const r of rows) {
      if (!r.live || r.orderStatus !== "captured") continue;
      totals.tipCount += 1;
      totals.grossMinor += r.grossMinor;
      totals.ourFeeMinor += r.ourFeeMinor;
      totals.processingChargeMinor += r.processingChargeMinor;
      totals.creatorShareMinor += r.creatorShareMinor;
    }
    return { rows, totals, truncated };
  });
}

export interface SettlementRow {
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
}

// Nothing in the site writes settlements yet, so this is expected to be empty
// until provider reconciliation is built; the page says so.
export function getSettlements(db: LedgerDb, range: DateRange): Promise<Loaded<SettlementRow[]>> {
  return load("settlements", async () => {
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
      select s.id::text                          as settlement_id,
             s.provider_ref,
             s.settled_at,
             s.expected_at,
             s.settlement_amount_minor::text     as settlement_amount_minor,
             s.fees_minor::text                  as fees_minor,
             s.taxes_minor::text                 as taxes_minor,
             s.net_amount_minor::text            as net_amount_minor,
             s.currency,
             s.status,
             coalesce(si.payment_count, 0)::text as payment_count
        from settlements s
        left join (
          select settlement_id, count(*) as payment_count
            from settlement_items
           group by settlement_id
        ) si on si.settlement_id = s.id
       where s.created_at >= ${range.from.toISOString()}::timestamptz
         and s.created_at <  ${range.to.toISOString()}::timestamptz
       order by coalesce(s.settled_at, s.expected_at) desc
    `;

    return rows.map((r) => ({
      settlementId: toWhole(r.settlement_id),
      providerRef: r.provider_ref,
      settledAt: r.settled_at,
      expectedAt: r.expected_at,
      grossMinor: toWhole(r.settlement_amount_minor),
      feesMinor: toWhole(r.fees_minor),
      taxesMinor: toWhole(r.taxes_minor),
      netMinor: toWhole(r.net_amount_minor),
      currency: r.currency,
      status: r.status,
      paymentCount: toWhole(r.payment_count),
    }));
  });
}

export interface ReconciliationSummary {
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
}

// Provider reconciliation runs (Razorpay's reports against the ledger). Not built
// yet: the tables exist but nothing writes them.
export function getReconciliationSummary(db: LedgerDb): Promise<Loaded<ReconciliationSummary>> {
  return load("reconciliation runs", async () => {
    const [runsRows, exceptionRows, itemRows] = await Promise.all([
      db<{ total: string; last_run: Date | null }[]>`
        select count(*)::text as total, max(completed_at) as last_run
          from reconciliation_runs
         where status = 'completed'
      `,
      db<{ open_exceptions: string | null; partial_matches: string | null }[]>`
        select sum(case when match_state = 'exception' then 1 else 0 end)::text as open_exceptions,
               sum(case when match_state = 'partial'   then 1 else 0 end)::text as partial_matches
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
        select ri.id::text                       as id,
               ri.internal_ref,
               ri.provider_ref,
               ri.match_state,
               ri.exception_reason,
               ri.expected_amount_minor::text    as expected_amount_minor,
               ri.observed_amount_minor::text    as observed_amount_minor,
               ri.currency
          from reconciliation_items ri
          join reconciliation_runs rr on rr.id = ri.run_id
         where ri.match_state in ('exception', 'unmatched', 'partial')
           and ri.resolved_at is null
         order by rr.started_at desc, ri.id desc
         limit 50
      `,
    ]);

    return {
      totalRuns: toWhole(runsRows[0]?.total ?? "0"),
      lastRunAt: runsRows[0]?.last_run ?? null,
      openExceptions: toWhole(exceptionRows[0]?.open_exceptions ?? "0"),
      partialMatches: toWhole(exceptionRows[0]?.partial_matches ?? "0"),
      recentItems: itemRows.map((r) => ({
        itemId: toWhole(r.id),
        internalRef: r.internal_ref,
        providerRef: r.provider_ref,
        matchState: r.match_state,
        exceptionReason: r.exception_reason,
        expectedMinor: r.expected_amount_minor != null ? toWhole(r.expected_amount_minor) : null,
        observedMinor: r.observed_amount_minor != null ? toWhole(r.observed_amount_minor) : null,
        currency: r.currency,
      })),
    };
  });
}
