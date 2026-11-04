import type { LedgerDb } from "../accrual";
import { load, toWhole, type Loaded } from "./result";

// Payout requests for the owner's page (/admin/payouts): what is waiting to be paid, what was paid or
// cancelled lately, and for each creator the whole picture of what they earned, what Freetip kept and
// what is owed. Read-only; nothing here moves money (see payouts.ts for that).

export interface PayoutAdminRow {
  id: number;
  creatorId: number;
  name: string | null;
  handle: string | null;
  // The UPI ID the money is to go to: the one copied when the request was made.
  upiVpa: string | null;
  // True when the creator's UPI ID on file differs from the one on the request.
  upiChanged: boolean;
  amountMinor: number;
  status: string;
  requestedAt: Date | null;
  // Whole days since the request was made (0 for one made today).
  waitedDays: number;
  completedAt: Date | null;
  // When a payout was cancelled or reversed.
  failedAt: Date | null;
  utr: string | null;
  firstPayout: boolean;
  // Why a payout was cancelled, or reversed after it was marked paid.
  cancelReason: string | null;
}

export interface CreatorTotals {
  tipCount: number;
  // What fans paid, net of tips taken back, and how it split.
  grossMinor: number;
  freetipFeeMinor: number;
  processingMinor: number;
  creatorShareMinor: number;
  // Payouts already paid to this creator.
  paidOutMinor: number;
}

export interface OpenPayouts {
  rows: PayoutAdminRow[];
  totals: Map<number, CreatorTotals>;
}

type RawRow = {
  id: string;
  creator_id: string;
  name: string | null;
  handle: string | null;
  upi_vpa: string | null;
  current_upi: string | null;
  amount_minor: string;
  status: string;
  requested_at: Date | null;
  completed_at: Date | null;
  failed_at: Date | null;
  utr: string | null;
  first_payout: boolean;
  cancel_reason: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const toRow = (r: RawRow, now: Date): PayoutAdminRow => ({
  id: toWhole(r.id),
  creatorId: toWhole(r.creator_id),
  name: r.name,
  handle: r.handle,
  upiVpa: r.upi_vpa,
  upiChanged: r.upi_vpa !== null && (r.current_upi ?? "") !== r.upi_vpa,
  amountMinor: toWhole(r.amount_minor),
  status: r.status,
  requestedAt: r.requested_at,
  waitedDays: r.requested_at ? Math.max(0, Math.floor((now.getTime() - r.requested_at.getTime()) / DAY_MS)) : 0,
  completedAt: r.completed_at,
  failedAt: r.failed_at,
  utr: r.utr,
  firstPayout: r.first_payout,
  cancelReason: r.cancel_reason,
});

// Requests that are waiting for the owner, oldest first, each with the creator's totals.
export function listOpenPayouts(db: LedgerDb, now = new Date()): Promise<Loaded<OpenPayouts>> {
  return load("payout requests", async () => {
    const raw = await db<RawRow[]>`
      select p.id::text as id, p.creator_id::text as creator_id, u.name, u.handle, p.upi_vpa,
             u.upi_vpa as current_upi, p.amount_minor::text as amount_minor, p.status,
             coalesce(p.requested_at, p.created_at) as requested_at, p.completed_at, p.failed_at,
             p.provider_transfer_ref as utr, p.first_payout, coalesce(p.cancel_reason, p.failure_reason) as cancel_reason
        from creator_payouts p
        join users u on u.id = p.creator_id
       where p.status in ('initiated', 'in_transit')
       order by coalesce(p.requested_at, p.created_at), p.id
    `;
    const rows = raw.map((r) => toRow(r, now));
    const totals = await loadTotals(db, [...new Set(rows.map((r) => r.creatorId))]);
    return { rows, totals };
  });
}

// The newest paid and cancelled payouts.
export function listRecentPayouts(db: LedgerDb, limit = 30, now = new Date()): Promise<Loaded<PayoutAdminRow[]>> {
  return load("recent payouts", async () => {
    const raw = await db<RawRow[]>`
      select p.id::text as id, p.creator_id::text as creator_id, u.name, u.handle, p.upi_vpa,
             u.upi_vpa as current_upi, p.amount_minor::text as amount_minor, p.status,
             coalesce(p.requested_at, p.created_at) as requested_at, p.completed_at, p.failed_at,
             p.provider_transfer_ref as utr, p.first_payout, coalesce(p.cancel_reason, p.failure_reason) as cancel_reason
        from creator_payouts p
        join users u on u.id = p.creator_id
       where p.status not in ('initiated', 'in_transit')
       order by coalesce(p.failed_at, p.completed_at, p.created_at) desc, p.id desc
       limit ${limit}
    `;
    return raw.map((r) => toRow(r, now));
  });
}

// Per creator, read from the ledger so it agrees with every other money page: tips and how each
// rupee split (the ledger nets a tip taken back to nothing), and what has been paid out so far.
export async function loadTotals(db: LedgerDb, creatorIds: number[]): Promise<Map<number, CreatorTotals>> {
  const out = new Map<number, CreatorTotals>();
  if (creatorIds.length === 0) return out;
  const ids = creatorIds.map(String);

  const split = await db<{
    creator_id: string;
    tips: string;
    gross: string;
    fee: string;
    processing: string;
    share: string;
  }[]>`
    select x.creator_id::text as creator_id,
           count(distinct case when x.event_type = 'tip_captured' then x.id end)::text as tips,
           coalesce(sum(case when a.code = 'processor_clearing' then e.debit_minor - e.credit_minor end), 0)::text as gross,
           coalesce(sum(case when a.code = 'platform_fee_revenue' then e.credit_minor - e.debit_minor end), 0)::text as fee,
           coalesce(sum(case when a.code = 'gateway_fee_expense' then e.credit_minor - e.debit_minor end), 0)::text as processing,
           coalesce(sum(case when a.code = 'creator_payable' then e.credit_minor - e.debit_minor end), 0)::text as share
      from ledger_transactions x
      join ledger_entries e  on e.ledger_transaction_id = x.id
      join ledger_accounts a on a.id = e.account_id
     where x.source_type = 'tip_order' and x.creator_id = any(${ids}::bigint[])
     group by x.creator_id
  `;
  const paid = await db<{ creator_id: string; paid: string }[]>`
    select creator_id::text as creator_id, coalesce(sum(amount_minor), 0)::text as paid
      from creator_payouts where status = 'completed' and creator_id = any(${ids}::bigint[])
     group by creator_id
  `;
  const paidBy = new Map(paid.map((p) => [toWhole(p.creator_id), toWhole(p.paid)]));
  for (const r of split) {
    const id = toWhole(r.creator_id);
    out.set(id, {
      tipCount: toWhole(r.tips),
      grossMinor: toWhole(r.gross),
      freetipFeeMinor: toWhole(r.fee),
      processingMinor: toWhole(r.processing),
      creatorShareMinor: toWhole(r.share),
      paidOutMinor: paidBy.get(id) ?? 0,
    });
  }
  for (const id of creatorIds) {
    if (!out.has(id)) {
      out.set(id, { tipCount: 0, grossMinor: 0, freetipFeeMinor: 0, processingMinor: 0, creatorShareMinor: 0, paidOutMinor: paidBy.get(id) ?? 0 });
    }
  }
  return out;
}
