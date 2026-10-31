import type { LedgerDb } from "./accrual";

// Tips are final: there is no refund feature. Money can still leave in two ways
// Freetip does not control: a payment error put right in Razorpay's dashboard, or a
// bank-forced chargeback that Razorpay reports as lost. Either way Razorpay takes
// the whole payment back, so the books undo the tip: the capture posting is
// reversed line for line (the creator's share, our fee and the processing charge
// all go back to what Razorpay owes us) and the tip is marked refunded or disputed.
// Record only: nothing here holds, reserves or pays anything. A dispute is
// recorded when it is lost, not when it opens.
//
// A reversal covers a whole payment only. A partial amount is not posted (the
// caller logs it for the owner to look at). One reversal per capture (unique index
// on reversal_of), so a repeated webhook posts once. A tip that was never posted
// (test mode, never captured) has nothing to reverse and is left alone.

export type ReversalKind = "refund" | "dispute_lost";

export type ReversalResult =
  | { status: "reversed" }
  | { status: "already" }
  | { status: "skipped"; reason: "no_capture_posting" | "partial_amount" };

export async function postTipReversal(
  db: LedgerDb,
  paymentRef: string,
  amountPaise: number,
  kind: ReversalKind,
): Promise<ReversalResult> {
  return db.begin(async (tx) => {
    const [facts] = await tx<{ tip_id: string; gross: string; capture_id: string | null }[]>`
      select t.id::text                 as tip_id,
             t.gross_amount_minor::text as gross,
             lt.id::text                as capture_id
        from payment_attempts pa
        join tip_orders t on t.id = pa.tip_order_id
        left join ledger_transactions lt on lt.idempotency_key = 'capture:' || pa.provider_payment_ref
       where pa.provider_payment_ref = ${paymentRef}
    `;
    if (!facts || facts.capture_id === null) {
      return { status: "skipped", reason: "no_capture_posting" } as const;
    }
    if (Number(facts.gross) !== amountPaise) {
      return { status: "skipped", reason: "partial_amount" } as const;
    }

    const memo = kind === "refund" ? "Tip refunded by Razorpay" : "Chargeback lost";
    const [header] = await tx<{ id: string }[]>`
      insert into ledger_transactions
        (event_type, source_type, source_ref, creator_id, currency, effective_at,
         idempotency_key, reversal_of, memo)
      select 'tip_reversed', lt.source_type, lt.source_ref, lt.creator_id, lt.currency, now(),
             'reversal:' || lt.id::text, lt.id, ${memo}::text
        from ledger_transactions lt
       where lt.id = ${facts.capture_id}::bigint
      on conflict (idempotency_key) do nothing
      returning id::text
    `;
    if (!header) return { status: "already" } as const;

    await tx`
      insert into ledger_entries
        (ledger_transaction_id, account_id, creator_id, debit_minor, credit_minor, currency)
      select ${header.id}::bigint, e.account_id, e.creator_id, e.credit_minor, e.debit_minor, e.currency
        from ledger_entries e
       where e.ledger_transaction_id = ${facts.capture_id}::bigint
    `;

    const status = kind === "refund" ? "refunded" : "disputed";
    await tx`
      update tip_orders set status = ${status}::text
       where id = ${facts.tip_id}::bigint and status = 'captured'
    `;
    return { status: "reversed" } as const;
  });
}
