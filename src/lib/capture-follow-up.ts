import { postCaptureAccrual, type LedgerDb } from "./accrual";

// What happens after the Razorpay webhook has captured a tip, each step on its own
// so one failing never blocks the next or undoes the capture:
//   1. save what Razorpay says it captured (amount, currency, fee, tax), so the
//      posting can check it against the order;
//   2. post the creator's share to the books (idempotent; the daily sweep covers a
//      failure here);
//   3. keep a minimal record of the event once its outcome is final (no payer
//      details: email, phone and UPI ID stay with the payment partner, as the
//      privacy page says).
// It never throws. A migration that has not been run yet shows up as a logged
// error here and nothing else changes.

export interface CapturedPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  method?: string;
  fee?: number | null;
  tax?: number | null;
}

const wholeOrNull = (n: unknown) => (typeof n === "number" && Number.isSafeInteger(n) ? n : null);

export async function afterCapture(
  db: LedgerDb,
  payment: CapturedPayment,
  eventId: string | null,
): Promise<void> {
  const amount = wholeOrNull(payment.amount);
  try {
    await db`
      update payment_attempts
         set captured_amount_minor = ${amount}::bigint,
             captured_currency     = ${payment.currency}::text,
             provider_fee_minor    = ${wholeOrNull(payment.fee)}::bigint,
             provider_tax_minor    = ${wholeOrNull(payment.tax)}::bigint
       where provider_payment_ref = ${payment.id}
         and captured_amount_minor is null
    `;
  } catch (err) {
    console.error("Capture: could not save Razorpay's captured amount (migration 0023 run?)", payment.id, err);
  }

  // Only a final outcome is logged as the event's status: the log cannot be edited,
  // so a status written before the result is known could never be corrected.
  let outcome: "processed" | "ignored" | null = null;
  try {
    const result = await postCaptureAccrual(db, payment.id);
    if (result.status === "posted" || result.status === "already") outcome = "processed";
    else if (result.reason === "test_mode") outcome = "ignored";
    // Test-mode payments are expected to be skipped; anything else is worth a look.
    if (result.status === "skipped" && result.reason !== "test_mode") {
      console.error("Accrual skipped", payment.id, payment.order_id, result.reason);
    }
  } catch (err) {
    console.error("Accrual failed, the daily sweep will retry", payment.id, err);
  }

  if (!eventId || !outcome) return;
  try {
    // An object, not a JSON string: postgres.js turns the value bound to a jsonb
    // parameter into JSON itself, so a string would be stored as a quoted string.
    const record = {
      payment_id: payment.id,
      order_id: payment.order_id,
      amount,
      currency: payment.currency,
      method: payment.method ?? null,
      fee: wholeOrNull(payment.fee),
      tax: wholeOrNull(payment.tax),
    };
    await db`
      insert into provider_events
        (provider, event_id, event_type, payload, processing_status, processed_at, linked_entity_type)
      values
        ('razorpay', ${eventId}::text, 'payment.captured', ${record}::jsonb, ${outcome}::text, now(), 'payment_attempt')
      on conflict (provider, event_id) do nothing
    `;
  } catch (err) {
    console.error("Capture: could not log the event", eventId, err);
  }
}
