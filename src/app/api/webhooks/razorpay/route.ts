import { createHmac, timingSafeEqual } from "crypto";
import { getDb } from "@/lib/db";

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
  error_code?: string;
  error_description?: string;
}

interface RazorpayEvent {
  event?: string;
  payload?: {
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
        }
      });
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

    default:
      // Acknowledge unknown events so Razorpay does not retry them.
      break;
  }

  return new Response("OK", { status: 200 });
}
