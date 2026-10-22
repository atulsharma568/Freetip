import { createHmac, timingSafeEqual } from "crypto";
import { getDb } from "@/lib/db";

// Razorpay sends X-Razorpay-Signature: HMAC-SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET).
// Signature mismatch → 400. Unknown events → 200 (prevents Razorpay retries).
//
// Idempotency: payment_attempts.provider_payment_ref has a UNIQUE constraint.
// A second webhook for the same payment_id updates 0 rows → we return 200 without
// processing again.

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

      // Update the payment_attempt row. The provider_payment_ref UNIQUE constraint
      // makes this idempotent: a duplicate webhook for the same pay_xxx updates 0 rows.
      const updated = await db<{ tip_order_id: number }[]>`
        update payment_attempts
        set
          provider_payment_ref = ${payment.id},
          provider_status      = 'captured',
          payment_method       = ${payment.method ?? null},
          captured_at          = now()
        where provider_order_ref = ${payment.order_id}
          and provider_payment_ref is null
        returning tip_order_id
      `;

      if (updated.length > 0) {
        await db`
          update tip_orders
          set status      = 'captured',
              captured_at = now()
          where id = ${updated[0].tip_order_id}
        `;
      }
      break;
    }

    case "payment.failed": {
      const payment = event.payload?.payment?.entity;
      if (!payment || !db) break;

      const updated = await db<{ tip_order_id: number }[]>`
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
        await db`
          update tip_orders
          set status = 'failed'
          where id = ${updated[0].tip_order_id}
            and status = 'payment_pending'
        `;
      }
      break;
    }

    default:
      // Acknowledge unknown events so Razorpay does not retry them.
      break;
  }

  return new Response("OK", { status: 200 });
}
