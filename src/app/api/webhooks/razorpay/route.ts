import { createHmac, timingSafeEqual } from "crypto";
import { after } from "next/server";
import { getDb } from "@/lib/db";
import type { LedgerDb } from "@/lib/accrual";
import { afterCapture } from "@/lib/capture-follow-up";
import { postTipReversal } from "@/lib/reversal";
import { reverseFanXp } from "@/lib/fan-profiles";
import { settleRazorpayPlan } from "@/lib/plan-settle";
import { readPayment } from "@/lib/razorpay-plan";

// Razorpay sends X-Razorpay-Signature: HMAC-SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET).
// Signature mismatch → 400. Unknown events → 200 (prevents Razorpay retries).
//
// One Razorpay order has one payment_attempts row but can see several payments:
// the fan can fail a payment and retry in the same checkout popup. The row holds
// the latest outcome, and a capture always wins:
//   - captured replaces a failed row (and is ignored once the row is captured, so
//     a duplicate webhook does nothing);
//   - failed only fills a row that has no payment yet, so a late failure for an
//     earlier payment can never overwrite a capture.
// The attempt row and the tip order change in one transaction, so a crash between
// the two can't leave the order behind: Razorpay's retry then redoes both.

function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

interface RazorpayPaymentEntity {
  id: string;           // pay_xxx
  order_id: string;     // order_xxx
  amount: number;       // paise
  currency: string;
  status: string;
  method?: string;
  fee?: number | null;  // paise, Razorpay's charge incl. GST; may be null at capture
  tax?: number | null;  // paise, the GST part of fee
  error_code?: string;
  error_description?: string;
}

interface RazorpayTakeback {
  payment_id?: string;
  amount: number;       // paise
}

interface RazorpayEvent {
  event?: string;
  payload?: {
    refund?: { entity?: RazorpayTakeback };
    dispute?: { entity?: RazorpayTakeback };
    payment?: {
      entity?: RazorpayPaymentEntity;
    };
  };
}

export async function POST(request: Request): Promise<Response> {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const rawBody = await request.text();

  if (!verifySignature(rawBody, signature, webhookSecret)) {
    return new Response("Invalid signature", { status: 400 });
  }

  let event: RazorpayEvent;
  try {
    event = JSON.parse(rawBody) as RazorpayEvent;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const db = getDb();

  // A paid plan (Starter or Creator) bought on /dashboard/plans goes through the same Razorpay account.
  // Its order is a plan order, not a tip: settle it from the signed payment and stop here. Anything that
  // is not a plan order (null) carries on to the tip handling below, unchanged. A database error throws,
  // so Razorpay is answered 500 and sends the event again.
  if (event.event === "payment.captured" || event.event === "payment.failed") {
    const payment = event.payload?.payment?.entity;
    if (payment?.order_id) {
      const known =
        event.event === "payment.captured"
          ? readPayment({ ...payment, status: "captured" })
          : readPayment({ ...payment, status: "failed" });
      const plan = await settleRazorpayPlan(payment.order_id, known);
      if (plan) {
        // Not decided yet (keys missing): ask Razorpay to send it again later. Anything else, including
        // a payment not believed (logged), is final for this event.
        if (plan.status === "not_set_up" || plan.status === "unavailable") return new Response("Try again", { status: 503 });
        return new Response("OK", { status: 200 });
      }
    }
  }

  switch (event.event) {
    case "payment.captured": {
      const payment = event.payload?.payment?.entity;
      if (!payment || !db) break;

      await db.begin(async (tx) => {
        const updated = await tx<{ tip_order_id: number }[]>`
          update payment_attempts
          set
            provider_payment_ref = ${payment.id},
            provider_status      = 'captured',
            payment_method       = ${payment.method ?? null},
            captured_at          = now(),
            failure_code         = null,
            failure_reason       = null,
            failed_at            = null
          where provider_order_ref = ${payment.order_id}
            and (provider_payment_ref is null or provider_status = 'failed')
          returning tip_order_id
        `;

        if (updated.length > 0) {
          await tx`
            update tip_orders
            set status      = 'captured',
                captured_at = now()
            where id = ${updated[0].tip_order_id}
              and status not in ('refunded', 'disputed', 'closed')
          `;
        } else {
          // Nothing to update is normal for a duplicate webhook. No row at all means
          // money was captured for an order we never saved (createTipOrder saves
          // before the fan can pay, so this is not expected): log it so it is found.
          // We still answer 200: a retry can't create the row, and repeated failures
          // can get the webhook switched off at Razorpay.
          const known = await tx`
            select 1 from payment_attempts where provider_order_ref = ${payment.order_id} limit 1
          `;
          if (known.length === 0) {
            console.error(
              "Razorpay capture with no matching payment attempt",
              payment.id,
              payment.order_id,
              payment.amount,
            );
          }
        }
      });

      // The capture above is committed. What follows (saving Razorpay's captured
      // amount, posting the creator's share, logging the event) must never delay
      // the answer or undo the capture, so it runs after the response is sent;
      // afterCapture catches its own errors, and it also runs for a repeated
      // delivery so a posting that failed earlier is retried. The daily sweep
      // covers anything that still did not run.
      const eventId = request.headers.get("x-razorpay-event-id");
      const ledgerDb = db as unknown as LedgerDb;
      after(() => afterCapture(ledgerDb, payment, eventId));
      break;
    }

    case "payment.failed": {
      const payment = event.payload?.payment?.entity;
      if (!payment || !db) break;

      await db.begin(async (tx) => {
        const updated = await tx<{ tip_order_id: number }[]>`
          update payment_attempts
          set
            provider_payment_ref = ${payment.id},
            provider_status      = 'failed',
            failure_code         = ${payment.error_code ?? null},
            failure_reason       = ${payment.error_description ?? null},
            failed_at            = now()
          where provider_order_ref = ${payment.order_id}
            and provider_payment_ref is null
          returning tip_order_id
        `;

        if (updated.length > 0) {
          await tx`
            update tip_orders
            set status = 'failed'
            where id = ${updated[0].tip_order_id}
              and status = 'payment_pending'
          `;
        }
      });
      break;
    }

    // Tips are final, so these are not a feature: they are Razorpay taking a whole
    // payment back (a payment error put right, or a chargeback lost). Record only.
    case "refund.processed":
    case "payment.dispute.lost": {
      const kind = event.event === "refund.processed" ? "refund" : "dispute_lost";
      const entity = kind === "refund" ? event.payload?.refund?.entity : event.payload?.dispute?.entity;
      if (!entity?.payment_id || !db) break;

      const ledgerDb = db as unknown as LedgerDb;
      const paymentId = entity.payment_id;
      const amount = entity.amount;
      after(async () => {
        try {
          const result = await postTipReversal(ledgerDb, paymentId, amount, kind);
          if (result.status === "skipped" && result.reason === "partial_amount") {
            console.error("Razorpay took back part of a payment; not posted, look at it by hand", paymentId, amount);
          }
          // The tip no longer counts for the fan's level (only a whole payment). Its own try:
          // a missing migration 0038 must not make the ledger reversal look failed.
          if (!(result.status === "skipped" && result.reason === "partial_amount")) {
            try {
              await reverseFanXp(ledgerDb, paymentId);
            } catch (err) {
              console.error("Could not take the tip back from the fan profile (migration 0038 run?)", paymentId, err);
            }
          }
        } catch (err) {
          console.error("Could not record a reversal; Razorpay will retry", paymentId, err);
        }
      });
      break;
    }

    default:
      // Acknowledge unknown events so Razorpay does not retry them.
      break;
  }

  return new Response("OK", { status: 200 });
}
