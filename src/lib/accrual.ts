import { RULE_VERSION, capturePosting, checkRates, feeLines, splitTip, toPaise } from "./money";

// Writes what a captured tip is worth into the books: one balanced ledger
// transaction (what Razorpay owes us, what we owe the creator, our fee, the
// processing charge) and the matching fee lines. It runs AFTER the webhook has
// captured the tip, in its own database transaction, so a problem here can never
// undo a real capture: the daily sweep (`postMissingAccruals`) posts whatever was
// missed. Everything is keyed by the Razorpay payment id, so calling it twice, or
// from the webhook and the sweep at once, posts once.
//
// No site imports and no `server-only`, so the tests can run it against an
// in-memory Postgres.

type Row = Record<string, unknown>;
export type Query = <R extends Row[] = Row[]>(
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<R>;
export interface LedgerDb extends Query {
  begin<T>(fn: (tx: Query) => Promise<T>): Promise<T>;
}

export type AccrualResult =
  | { status: "posted" }
  | { status: "already" }
  | { status: "skipped"; reason: AccrualSkipReason };

export type AccrualSkipReason =
  | "no_such_payment"
  | "not_captured"
  | "test_mode"
  | "no_captured_facts"
  | "amount_mismatch";

export const captureKey = (paymentRef: string) => `capture:${paymentRef}`;

interface Facts extends Row {
  tip_id: string;
  creator_id: string;
  attempt_id: string;
  gross: string;
  attempt_amount: string;
  captured_amount: string | null;
  captured_currency: string | null;
  tip_currency: string;
  tip_status: string;
  provider_status: string | null;
  livemode: boolean | null;
  platform_bps: number;
  processing_bps: number;
}

export async function postCaptureAccrual(
  db: LedgerDb,
  paymentRef: string,
): Promise<AccrualResult> {
  return db.begin(async (tx) => {
    const [facts] = await tx<Facts[]>`
      select t.id::text                 as tip_id,
             t.creator_id::text         as creator_id,
             pa.id::text                as attempt_id,
             t.gross_amount_minor::text as gross,
             pa.amount_minor::text      as attempt_amount,
             pa.captured_amount_minor::text as captured_amount,
             pa.captured_currency       as captured_currency,
             t.currency                 as tip_currency,
             t.status                   as tip_status,
             pa.provider_status         as provider_status,
             pa.livemode                as livemode,
             t.platform_bps             as platform_bps,
             t.processing_bps           as processing_bps
        from payment_attempts pa
        join tip_orders t on t.id = pa.tip_order_id
       where pa.provider_payment_ref = ${paymentRef}
    `;
    if (!facts) return { status: "skipped", reason: "no_such_payment" } as const;

    // Only a tip that is really captured counts. A tip that was refunded, disputed
    // or closed before this ran stays out of the creator's balance.
    if (facts.tip_status !== "captured" || facts.provider_status !== "captured") {
      return { status: "skipped", reason: "not_captured" } as const;
    }
    // Test-mode money (and anything made before livemode was recorded) is never
    // posted: the ledger cannot be edited, so fake money in it would stay.
    if (facts.livemode !== true) return { status: "skipped", reason: "test_mode" } as const;
    if (facts.captured_amount === null || facts.captured_currency === null) {
      return { status: "skipped", reason: "no_captured_facts" } as const;
    }

    const gross = toPaise(facts.gross);
    if (
      toPaise(facts.attempt_amount) !== gross ||
      toPaise(facts.captured_amount) !== gross ||
      facts.captured_currency !== "INR" ||
      facts.tip_currency !== "INR"
    ) {
      return { status: "skipped", reason: "amount_mismatch" } as const;
    }

    // The rates this tip was charged at, copied onto the order when it was made (so a later change
    // of rate never reaches it). A pair outside the allowed range throws here, loudly, rather than
    // posting an odd amount; the sweep tries again once it is fixed.
    const rates = checkRates({ platformBps: facts.platform_bps, processingBps: facts.processing_bps });
    const split = splitTip(gross, rates);
    const key = captureKey(paymentRef);

    const [header] = await tx<{ id: string }[]>`
      insert into ledger_transactions
        (event_type, source_type, source_ref, creator_id, currency, effective_at, idempotency_key, memo)
      select 'tip_captured', 'tip_order', t.id::text, t.creator_id, 'INR',
             coalesce(t.captured_at, now()), ${key}::text, 'Tip captured'
        from tip_orders t
       where t.id = ${facts.tip_id}::bigint
      on conflict (idempotency_key) do nothing
      returning id::text
    `;
    if (!header) return { status: "already" } as const;

    for (const line of capturePosting(split)) {
      const named = line.account === "creator_payable" ? facts.creator_id : null;
      await tx`
        insert into ledger_entries
          (ledger_transaction_id, account_id, creator_id, debit_minor, credit_minor, currency)
        select ${header.id}::bigint, a.id, ${named}::bigint,
               ${line.debitPaise}::bigint, ${line.creditPaise}::bigint, 'INR'
          from ledger_accounts a
         where a.code = ${line.account}::text
      `;
    }

    for (const fee of feeLines(split, rates)) {
      await tx`
        insert into fee_lines
          (tip_order_id, payment_attempt_id, creator_id, fee_type, amount_minor, currency,
           rate_basis, rate_value, rule_version, effective_at, source)
        select t.id, ${facts.attempt_id}::bigint, t.creator_id, ${fee.feeType}::text,
               ${fee.amountPaise}::bigint, 'INR',
               'percent_of_gross', ${(fee.bps / 10000).toFixed(8)}::numeric, ${RULE_VERSION}::text,
               coalesce(t.captured_at, now()), 'accrual'
          from tip_orders t
         where t.id = ${facts.tip_id}::bigint
        on conflict do nothing
      `;
    }

    return { status: "posted" } as const;
  });
}

export interface SweepResult {
  looked: number;
  posted: number;
  already: number;
  skipped: Record<string, number>;
  failed: number;
}

// Posts any captured live tip that has no capture transaction yet. This is what
// heals a posting that failed after its capture, and it is safe to run as often
// as wanted. One bad tip never stops the others, and the picks are in random order
// so a few tips that keep failing cannot crowd newer ones out of the batch.
export async function postMissingAccruals(db: LedgerDb, limit = 200): Promise<SweepResult> {
  const rows = await db<{ payment_ref: string }[]>`
    select pa.provider_payment_ref as payment_ref
      from payment_attempts pa
      join tip_orders t on t.id = pa.tip_order_id
     where t.status = 'captured'
       and pa.provider_status = 'captured'
       and pa.livemode is true
       and pa.provider_payment_ref is not null
       and pa.captured_amount_minor = t.gross_amount_minor
       and pa.amount_minor = t.gross_amount_minor
       and pa.captured_currency = 'INR'
       and t.currency = 'INR'
       and not exists (
         select 1 from ledger_transactions lt
          where lt.idempotency_key = 'capture:' || pa.provider_payment_ref
       )
     order by random()
     limit ${limit}
  `;

  const result: SweepResult = { looked: rows.length, posted: 0, already: 0, skipped: {}, failed: 0 };
  for (const { payment_ref } of rows) {
    try {
      const r = await postCaptureAccrual(db, payment_ref);
      if (r.status === "posted") result.posted += 1;
      else if (r.status === "already") result.already += 1;
      else result.skipped[r.reason] = (result.skipped[r.reason] ?? 0) + 1;
    } catch (err) {
      result.failed += 1;
      console.error("Accrual sweep: could not post", payment_ref, err);
    }
  }
  return result;
}

export interface UnpostableCapture {
  paymentRef: string;
  tipId: string;
  reason: "no_captured_facts" | "amount_mismatch";
}

// Captured live tips the sweep will never post because Razorpay's captured
// amount or currency is missing or does not match the order. Shown to the owner
// (a person has to look at these); they are not retried.
export async function findUnpostableCaptures(db: LedgerDb, limit = 50): Promise<UnpostableCapture[]> {
  const rows = await db<{ payment_ref: string; tip_id: string; reason: UnpostableCapture["reason"] }[]>`
    select pa.provider_payment_ref as payment_ref,
           t.id::text              as tip_id,
           case when pa.captured_amount_minor is null or pa.captured_currency is null
                then 'no_captured_facts' else 'amount_mismatch' end as reason
      from payment_attempts pa
      join tip_orders t on t.id = pa.tip_order_id
     where t.status = 'captured'
       and pa.provider_status = 'captured'
       and pa.livemode is true
       and pa.provider_payment_ref is not null
       and (
             pa.captured_amount_minor = t.gross_amount_minor
         and pa.amount_minor = t.gross_amount_minor
         and pa.captured_currency = 'INR'
         and t.currency = 'INR'
       ) is not true
       and not exists (
         select 1 from ledger_transactions lt
          where lt.idempotency_key = 'capture:' || pa.provider_payment_ref
       )
     order by t.captured_at
     limit ${limit}
  `;
  return rows.map((r) => ({ paymentRef: r.payment_ref, tipId: r.tip_id, reason: r.reason }));
}
