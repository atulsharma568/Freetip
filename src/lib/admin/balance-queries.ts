import type { LedgerDb } from "../accrual";
import { LONGEST_HOLD_DAYS, MIN_PAYOUT_PAISE, workOutBalance, type TipForHold } from "../balances";
import { load, toWhole, type Loaded } from "./result";

// What each creator is owed now and how much of it can be paid (see balances.ts).
// Live money only, because test-mode tips are never posted to the ledger. A
// creator is listed when anything sits on their creator_payable account.

export interface CreatorBalanceRow {
  creatorId: number;
  name: string | null;
  handle: string | null;
  creatorStatus: string;
  hasUpiId: boolean;
  hasCompletedPayout: boolean;
  balanceMinor: number;
  heldMinor: number;
  availableMinor: number;
  nextReleaseAt: Date | null;
  // Available is at least the minimum payout (the account is also active and has a UPI ID).
  payableNow: boolean;
}

export interface BalancesSummary {
  rows: CreatorBalanceRow[];
  minPayoutMinor: number;
  fetchedAt: Date;
}

export function getCreatorBalances(db: LedgerDb, now = new Date()): Promise<Loaded<BalancesSummary>> {
  return load("creator balances", async () => {
    const creators = await db<{
      creator_id: string;
      name: string | null;
      handle: string | null;
      creator_status: string;
      has_upi: boolean;
      has_completed_payout: boolean;
      balance: string;
    }[]>`
      select u.id::text as creator_id,
             u.name,
             u.handle,
             u.creator_status,
             (u.upi_vpa is not null and u.upi_vpa <> '') as has_upi,
             exists (select 1 from creator_payouts p
                      where p.creator_id = u.id and p.status = 'completed') as has_completed_payout,
             b.balance::text as balance
        from users u
        join (
          select e.creator_id, sum(e.credit_minor - e.debit_minor) as balance
            from ledger_entries e
            join ledger_accounts a on a.id = e.account_id and a.code = 'creator_payable'
           group by e.creator_id
        ) b on b.creator_id = u.id
       order by b.balance desc, u.id
    `;

    // The tips that can still be inside a hold: captured within the longest hold.
    const since = new Date(now.getTime() - LONGEST_HOLD_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const tipRows = await db<{
      creator_id: string;
      captured_at: Date;
      method: string | null;
      net: string;
    }[]>`
      select o.creator_id::text as creator_id,
             o.captured_at,
             (select pa.payment_method from payment_attempts pa
               where pa.tip_order_id = o.id and pa.provider_status = 'captured'
               order by pa.id desc limit 1) as method,
             sum(e.credit_minor - e.debit_minor)::text as net
        from tip_orders o
        join ledger_transactions x on x.source_type = 'tip_order' and x.source_ref = o.id::text
        join ledger_entries e      on e.ledger_transaction_id = x.id
        join ledger_accounts a     on a.id = e.account_id and a.code = 'creator_payable'
       where o.captured_at >= ${since}::timestamptz
       group by o.id, o.creator_id, o.captured_at
    `;

    const tipsByCreator = new Map<number, TipForHold[]>();
    for (const t of tipRows) {
      const id = toWhole(t.creator_id);
      const list = tipsByCreator.get(id) ?? [];
      list.push({ capturedAt: t.captured_at, method: t.method, netPaise: toWhole(t.net) });
      tipsByCreator.set(id, list);
    }

    const rows = creators.map((c): CreatorBalanceRow => {
      const creatorId = toWhole(c.creator_id);
      const b = workOutBalance(
        toWhole(c.balance),
        tipsByCreator.get(creatorId) ?? [],
        c.has_completed_payout,
        now,
      );
      return {
        creatorId,
        name: c.name,
        handle: c.handle,
        creatorStatus: c.creator_status,
        hasUpiId: c.has_upi,
        hasCompletedPayout: c.has_completed_payout,
        balanceMinor: b.balancePaise,
        heldMinor: b.heldPaise,
        availableMinor: b.availablePaise,
        nextReleaseAt: b.nextReleaseAt,
        payableNow:
          b.availablePaise >= MIN_PAYOUT_PAISE && c.creator_status === "active" && c.has_upi,
      };
    });

    return { rows, minPayoutMinor: MIN_PAYOUT_PAISE, fetchedAt: now };
  });
}
