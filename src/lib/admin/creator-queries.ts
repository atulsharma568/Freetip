import type { LedgerDb } from "../accrual";
import type { DateRange } from "./date-range";
import { load, toWhole, type Loaded } from "./result";

// Per creator, live money only (see finance-queries.ts for the definitions).
//
//   tips, gross      live tips captured in the period
//   creatorShare     creator_payable credit minus debit posted in the period by tips
//                    (a payout request is not a change in what the creator earned)
//   ourFee           platform_fee_revenue credit minus debit posted in the period
//                    (the ledger transaction names the creator)
//   owedNow          creator_payable plus payouts_in_flight, credit minus debit, all
//                    time: what still has to be paid out, including a payout that was
//                    asked for and not yet paid. NOT floored at zero: a creator who
//                    owes us money shows a negative figure.
//   lastTipAt        the latest live captured tip, all time
//
// A creator is listed when they have a live captured tip or anything on their
// creator_payable account.

export interface CreatorEarningsRow {
  creatorId: number;
  name: string | null;
  handle: string | null;
  ytChannelName: string | null;
  tipCount: number;
  grossMinor: number;
  creatorShareMinor: number;
  ourFeeMinor: number;
  owedNowMinor: number;
  lastTipAt: Date | null;
}

export function getCreatorEarnings(
  db: LedgerDb,
  range: DateRange,
): Promise<Loaded<CreatorEarningsRow[]>> {
  return load("creator earnings", async () => {
    const from = range.from.toISOString();
    const to = range.to.toISOString();

    const rows = await db<{
      creator_id: string;
      name: string | null;
      handle: string | null;
      yt_channel_name: string | null;
      tip_count: string;
      gross_minor: string;
      share_period: string;
      fee_period: string;
      owed_now: string;
      last_tip_at: Date | null;
    }[]>`
      select u.id::text                              as creator_id,
             u.name,
             u.handle,
             u.yt_channel_name,
             coalesce(t.tip_count, 0)::text          as tip_count,
             coalesce(t.gross_minor, 0)::text        as gross_minor,
             coalesce(sh.share_period, 0)::text      as share_period,
             coalesce(fe.fee_period, 0)::text        as fee_period,
             coalesce(sh.owed_now, 0)::text          as owed_now,
             lt.last_tip_at
        from users u
        left join (
          select o.creator_id,
                 count(*)                 as tip_count,
                 sum(o.gross_amount_minor) as gross_minor
            from tip_orders o
           where o.status = 'captured'
             and o.captured_at >= ${from}::timestamptz
             and o.captured_at <  ${to}::timestamptz
             and exists (select 1 from payment_attempts pa where pa.tip_order_id = o.id and pa.livemode is true)
           group by o.creator_id
        ) t on t.creator_id = u.id
        left join (
          select e.creator_id,
                 sum(e.credit_minor - e.debit_minor) as owed_now,
                 sum(case when x.effective_at >= ${from}::timestamptz
                           and x.effective_at <  ${to}::timestamptz
                           and a.code = 'creator_payable'
                           and x.source_type <> 'creator_payout'
                          then e.credit_minor - e.debit_minor else 0 end) as share_period
            from ledger_entries e
            join ledger_accounts a      on a.id = e.account_id and a.code in ('creator_payable', 'payouts_in_flight')
            join ledger_transactions x  on x.id = e.ledger_transaction_id
           group by e.creator_id
        ) sh on sh.creator_id = u.id
        left join (
          select x.creator_id,
                 sum(e.credit_minor - e.debit_minor) as fee_period
            from ledger_entries e
            join ledger_accounts a      on a.id = e.account_id and a.code = 'platform_fee_revenue'
            join ledger_transactions x  on x.id = e.ledger_transaction_id
           where x.effective_at >= ${from}::timestamptz
             and x.effective_at <  ${to}::timestamptz
           group by x.creator_id
        ) fe on fe.creator_id = u.id
        left join (
          select o.creator_id, max(o.captured_at) as last_tip_at
            from tip_orders o
           where o.status = 'captured'
             and exists (select 1 from payment_attempts pa where pa.tip_order_id = o.id and pa.livemode is true)
           group by o.creator_id
        ) lt on lt.creator_id = u.id
       where lt.creator_id is not null or sh.creator_id is not null
       order by coalesce(t.gross_minor, 0) desc, u.name, u.id
    `;

    return rows.map((r) => ({
      creatorId: toWhole(r.creator_id),
      name: r.name,
      handle: r.handle,
      ytChannelName: r.yt_channel_name,
      tipCount: toWhole(r.tip_count),
      grossMinor: toWhole(r.gross_minor),
      creatorShareMinor: toWhole(r.share_period),
      ourFeeMinor: toWhole(r.fee_period),
      owedNowMinor: toWhole(r.owed_now),
      lastTipAt: r.last_tip_at,
    }));
  });
}
