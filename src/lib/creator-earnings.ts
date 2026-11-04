import type { Query } from "./accrual";
import { LONGEST_HOLD_DAYS, workOutBalance, type TipForHold } from "./balances";
import { toPaise } from "./money";
import { toStatementRow, type StatementRow } from "./earnings-statement";

// What one creator is owed, read from the ledger (the same figures the owner sees in
// /admin/finance/balances, for one creator). Live money only: test-mode tips are never posted to
// the books, so they never appear here. Read-only; nothing here moves money.

export const STATEMENT_PAGE_SIZE = 25;
export const STATEMENT_EXPORT_MAX_ROWS = 10000;

export interface PayoutRow {
  id: number;
  amountPaise: number;
  status: string;
  at: Date;
}

export interface EarningsSummary {
  // Everything the books hold for the creator (can be negative after a lost dispute).
  balancePaise: number;
  // The part still inside its waiting period, and when the first tip frees up.
  pendingPaise: number;
  nextReleaseAt: Date | null;
  // Payouts that reached the creator.
  paidOutPaise: number;
  payouts: PayoutRow[];
}

export async function loadEarningsSummary(db: Query, creatorId: number, now = new Date()): Promise<EarningsSummary> {
  const [bal] = await db<{ balance: string }[]>`
    select coalesce(sum(e.credit_minor - e.debit_minor), 0)::text as balance
      from ledger_entries e
      join ledger_accounts a on a.id = e.account_id and a.code = 'creator_payable'
     where e.creator_id = ${creatorId}
  `;

  const payoutRows = await db<{
    id: string;
    amount_minor: string;
    status: string;
    at: Date;
  }[]>`
    select id::text as id, amount_minor::text as amount_minor, status,
           coalesce(completed_at, initiated_at, scheduled_at, created_at) as at
      from creator_payouts
     where creator_id = ${creatorId}
     order by created_at desc, id desc
     limit 50
  `;
  const hasCompletedPayout = payoutRows.some((p) => p.status === "completed");

  // The tips that can still be inside a hold: captured within the longest hold.
  const since = new Date(now.getTime() - LONGEST_HOLD_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const tipRows = await db<{ captured_at: Date; method: string | null; net: string }[]>`
    select o.captured_at,
           (select pa.payment_method from payment_attempts pa
             where pa.tip_order_id = o.id and pa.provider_status = 'captured'
             order by pa.id desc limit 1) as method,
           sum(e.credit_minor - e.debit_minor)::text as net
      from tip_orders o
      join ledger_transactions x on x.source_type = 'tip_order' and x.source_ref = o.id::text
      join ledger_entries e      on e.ledger_transaction_id = x.id
      join ledger_accounts a     on a.id = e.account_id and a.code = 'creator_payable'
     where o.creator_id = ${creatorId}
       and o.captured_at >= ${since}::timestamptz
     group by o.id, o.captured_at
  `;
  const tips: TipForHold[] = tipRows.map((t) => ({
    capturedAt: t.captured_at,
    method: t.method,
    netPaise: toPaise(t.net),
  }));
  const b = workOutBalance(toPaise(bal?.balance ?? 0), tips, hasCompletedPayout, now);

  const payouts = payoutRows.map((p) => ({
    id: toPaise(p.id),
    amountPaise: toPaise(p.amount_minor),
    status: p.status,
    at: p.at,
  }));
  return {
    balancePaise: b.balancePaise,
    pendingPaise: b.heldPaise,
    nextReleaseAt: b.nextReleaseAt,
    paidOutPaise: payouts.filter((p) => p.status === "completed").reduce((s, p) => s + p.amountPaise, 0),
    payouts,
  };
}

type StatementDbRow = {
  id: string;
  captured_at: Date;
  fan_name: string | null;
  gross_amount_minor: string;
  platform_bps: number;
  processing_bps: number;
  method: string | null;
  net: string;
};

// The creator's live tips that have been posted to the books, newest first, each with the ledger's
// figure for the creator's share. `limit` and `offset` page it; the export asks for one big page.
export async function loadStatement(
  db: Query,
  creatorId: number,
  limit: number,
  offset: number,
  now = new Date(),
): Promise<StatementRow[]> {
  const [paid] = await db<{ done: boolean }[]>`
    select exists (select 1 from creator_payouts p where p.creator_id = ${creatorId} and p.status = 'completed') as done
  `;
  const rows = await db<StatementDbRow[]>`
    select o.id::text as id, o.captured_at, o.fan_name, o.gross_amount_minor::text as gross_amount_minor,
           o.platform_bps, o.processing_bps,
           (select pa.payment_method from payment_attempts pa
             where pa.tip_order_id = o.id and pa.provider_status = 'captured'
             order by pa.id desc limit 1) as method,
           sum(e.credit_minor - e.debit_minor)::text as net
      from tip_orders o
      join ledger_transactions x on x.source_type = 'tip_order' and x.source_ref = o.id::text
      join ledger_entries e      on e.ledger_transaction_id = x.id
      join ledger_accounts a     on a.id = e.account_id and a.code = 'creator_payable'
     where o.creator_id = ${creatorId}
     group by o.id, o.captured_at, o.fan_name, o.gross_amount_minor, o.platform_bps, o.processing_bps
     order by o.captured_at desc, o.id desc
     limit ${limit}
    offset ${offset}
  `;
  return rows.map((r) =>
    toStatementRow(
      {
        tipId: toPaise(r.id),
        capturedAt: r.captured_at,
        fanName: r.fan_name,
        grossPaise: toPaise(r.gross_amount_minor),
        rates: { platformBps: r.platform_bps, processingBps: r.processing_bps },
        netPaise: toPaise(r.net),
        method: r.method,
      },
      paid?.done ?? false,
      now,
    ),
  );
}
