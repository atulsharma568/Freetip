import type { LedgerDb } from "../accrual";
import type { DateRange } from "./date-range";
import { load, toWhole, type Loaded } from "./result";

export { formatINR } from "./result";

// What the owner's finance pages count, in one place.
//
//  * Money is LIVE money only: a payment whose `payment_attempts.livemode` is
//    true. Test-mode payments (livemode false or never recorded) are never added
//    to a figure; they are only counted, so the page can say how many exist.
//  * "Posted to the books" figures come from the ledger (src/lib/accrual.ts
//    posts every captured live tip there), not from adding up tips:
//      owed to creators        = creator_payable credit minus debit
//      our fee                 = platform_fee_revenue credit minus debit
//      processing charge       = gateway_fee_expense credit minus debit (the flat
//                                charge we recover from creators; Razorpay's own
//                                charge is not posted yet)
//      Razorpay still owes us  = processor_clearing debit minus credit
//    Owed-to-creators and Razorpay-owes-us are balances (all time); the rest are
//    for the chosen period, by when the tip was captured.
//  * "Not yet posted" = captured live tips with no `capture:<payment id>` ledger
//    transaction. Always all time: it is a work queue, not a period figure.
//  * Nothing is floored at zero: a negative balance is shown negative.
//
// Every helper takes the database as its first argument and returns a `Loaded`
// result, so a failed read is told apart from an empty one.

export interface NotPosted {
  count: number;
  grossMinor: number;
  // Can be posted by the sweep now.
  postableCount: number;
  // Razorpay's captured amount is missing or differs from the order: a person must look.
  needsLookCount: number;
}

export interface FinanceSummary {
  // Live tips captured in the period.
  tipsCapturedCount: number;
  grossCapturedMinor: number;
  // Captured test-mode tips in the period (not counted in any money figure).
  testModeTipCount: number;
  // Posted to the books, for the period.
  creatorShareMinor: number;
  ourFeeMinor: number;
  processingChargeMinor: number;
  // Posted to the books, balances now (all time). Signed.
  owedToCreatorsMinor: number;
  razorpayOwesUsMinor: number;
  notPosted: NotPosted;
  fetchedAt: Date;
}

const iso = (d: Date) => d.toISOString();
// 0 - n rather than -n, so a zero balance is 0 and not -0.
const negate = (n: number) => 0 - n;

async function readNotPosted(db: LedgerDb): Promise<NotPosted> {
  const [row] = await db<{ n: string; gross: string; postable_n: string }[]>`
    select count(*)::text                                    as n,
           coalesce(sum(x.gross), 0)::text                   as gross,
           count(*) filter (where x.postable)::text          as postable_n
      from (
        select t.gross_amount_minor as gross,
               ((pa.captured_amount_minor = t.gross_amount_minor
                 and pa.amount_minor = t.gross_amount_minor
                 and pa.captured_currency = 'INR'
                 and t.currency = 'INR') is true) as postable
          from payment_attempts pa
          join tip_orders t on t.id = pa.tip_order_id
         where t.status = 'captured'
           and pa.provider_status = 'captured'
           and pa.livemode is true
           and pa.provider_payment_ref is not null
           and not exists (
             select 1 from ledger_transactions lt
              where lt.idempotency_key = 'capture:' || pa.provider_payment_ref
           )
      ) x
  `;
  const count = toWhole(row?.n ?? "0");
  const postable = toWhole(row?.postable_n ?? "0");
  return {
    count,
    grossMinor: toWhole(row?.gross ?? "0"),
    postableCount: postable,
    needsLookCount: count - postable,
  };
}

export function getNotPosted(db: LedgerDb): Promise<Loaded<NotPosted>> {
  return load("tips not yet posted", () => readNotPosted(db));
}

// Captured tips in the period that are not live money, for the "N test-mode tips
// are not counted" line on each page.
export function getTestModeTipCount(db: LedgerDb, range: DateRange): Promise<Loaded<number>> {
  return load("the test-mode tip count", async () => {
    const [row] = await db<{ n: string }[]>`
      select count(*)::text as n
        from tip_orders t
       where t.status = 'captured'
         and t.captured_at >= ${iso(range.from)}::timestamptz
         and t.captured_at <  ${iso(range.to)}::timestamptz
         and not exists (
           select 1 from payment_attempts pa where pa.tip_order_id = t.id and pa.livemode is true
         )
    `;
    return toWhole(row?.n ?? "0");
  });
}

export function getFinanceSummary(db: LedgerDb, range: DateRange): Promise<Loaded<FinanceSummary>> {
  return load("the finance summary", async () => {
    const from = iso(range.from);
    const to = iso(range.to);

    const [tipRows, ledgerRows, notPosted] = await Promise.all([
      db<{ live_n: string; live_gross: string; test_n: string }[]>`
        select count(*) filter (where x.live)::text                        as live_n,
               coalesce(sum(x.gross) filter (where x.live), 0)::text       as live_gross,
               count(*) filter (where not x.live)::text                    as test_n
          from (
            select t.gross_amount_minor as gross,
                   exists (
                     select 1 from payment_attempts pa
                      where pa.tip_order_id = t.id and pa.livemode is true
                   ) as live
              from tip_orders t
             where t.status = 'captured'
               and t.captured_at >= ${from}::timestamptz
               and t.captured_at <  ${to}::timestamptz
          ) x
      `,
      db<{ code: string; net_all: string; net_period: string }[]>`
        select a.code as code,
               coalesce(sum(e.credit_minor - e.debit_minor), 0)::text as net_all,
               coalesce(sum(case when lt.effective_at >= ${from}::timestamptz
                                  and lt.effective_at <  ${to}::timestamptz
                                 then e.credit_minor - e.debit_minor else 0 end), 0)::text as net_period
          from ledger_entries e
          join ledger_accounts a        on a.id  = e.account_id
          join ledger_transactions lt   on lt.id = e.ledger_transaction_id
         where a.code in ('creator_payable', 'platform_fee_revenue', 'gateway_fee_expense', 'processor_clearing')
         group by a.code
      `,
      readNotPosted(db),
    ]);

    // Credit minus debit per account; an account with no entries is simply zero.
    const net = (code: string) => {
      const r = ledgerRows.find((x) => x.code === code);
      return { all: toWhole(r?.net_all ?? "0"), period: toWhole(r?.net_period ?? "0") };
    };

    const tips = tipRows[0];
    return {
      tipsCapturedCount: toWhole(tips?.live_n ?? "0"),
      grossCapturedMinor: toWhole(tips?.live_gross ?? "0"),
      testModeTipCount: toWhole(tips?.test_n ?? "0"),
      creatorShareMinor: net("creator_payable").period,
      ourFeeMinor: net("platform_fee_revenue").period,
      processingChargeMinor: net("gateway_fee_expense").period,
      owedToCreatorsMinor: net("creator_payable").all,
      // Razorpay owes us what we debited: debit minus credit, the opposite sign.
      razorpayOwesUsMinor: negate(net("processor_clearing").all),
      notPosted,
      fetchedAt: new Date(),
    };
  });
}

// The GST registration trigger (docs/rules-check.md section 2): register when the larger of
// (our fees plus plan sales) and gross tips reaches this much in a financial year. It is set
// below the ₹20 lakh legal limit to leave time, because registration is due within 30 days.
export const GST_TRIGGER_MINOR = 1_500_000_00;

export interface Turnover {
  yearLabel: string;
  // Live tips captured in the financial year, gross.
  grossTipsMinor: number;
  // Our fee plus the processing charge we keep, posted to the ledger in the year, plus what live
  // pass purchases brought in (the price is the final amount, so the whole of it counts).
  feesMinor: number;
  // The pass-sales part of feesMinor, shown on its own.
  planSalesMinor: number;
  triggerMinor: number;
  // The larger of the two, which is the figure the trigger is tested against.
  countedMinor: number;
}

export function getTurnover(db: LedgerDb, year: DateRange): Promise<Loaded<Turnover>> {
  return load("the turnover figure", async () => {
    const from = iso(year.from);
    const to = iso(year.to);
    const [tipRows, feeRows] = await Promise.all([
      db<{ gross: string }[]>`
        select coalesce(sum(t.gross_amount_minor), 0)::text as gross
          from tip_orders t
         where t.status = 'captured'
           and t.captured_at >= ${from}::timestamptz
           and t.captured_at <  ${to}::timestamptz
           and exists (select 1 from payment_attempts pa where pa.tip_order_id = t.id and pa.livemode is true)
      `,
      db<{ fees: string }[]>`
        select coalesce(sum(e.credit_minor - e.debit_minor), 0)::text as fees
          from ledger_entries e
          join ledger_accounts a      on a.id  = e.account_id
          join ledger_transactions lt on lt.id = e.ledger_transaction_id
         where a.code in ('platform_fee_revenue', 'gateway_fee_expense')
           and lt.effective_at >= ${from}::timestamptz
           and lt.effective_at <  ${to}::timestamptz
      `,
    ]);
    // Pass sales (migration 0055). Before the migration is run the table is missing: that is zero
    // sales, not a failed read. A plan the owner ended early (a refund by hand) is not a sale.
    let planSalesMinor = 0;
    try {
      const [sales] = await db<{ sold: string }[]>`
        select coalesce(sum(amount_minor), 0)::text as sold from plan_orders
         where status = 'paid' and livemode and ended_at is null
           and paid_at >= ${from}::timestamptz and paid_at < ${to}::timestamptz
      `;
      planSalesMinor = toWhole(sales?.sold ?? "0");
    } catch (err) {
      if ((err as { code?: string }).code !== "42P01") throw err;
    }
    const grossTipsMinor = toWhole(tipRows[0]?.gross ?? "0");
    const feesMinor = toWhole(feeRows[0]?.fees ?? "0") + planSalesMinor;
    return {
      yearLabel: year.label,
      grossTipsMinor,
      feesMinor,
      planSalesMinor,
      triggerMinor: GST_TRIGGER_MINOR,
      countedMinor: Math.max(grossTipsMinor, feesMinor),
    };
  });
}
