import { createHmac, timingSafeEqual } from "crypto";

// Razorpay sends a X-Razorpay-Signature header: HMAC-SHA256 of the raw body
// signed with RAZORPAY_WEBHOOK_SECRET. Any mismatch returns 400.
//
// Events handled:
//   payment.captured  — reserved for tip order processing (not yet built)
//   payment.failed    — reserved for tip order failure handling (not yet built)
//
// All other events return 200 immediately so Razorpay does not retry them.

function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<Response> {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    // Misconfigured — fail closed so stray events aren't silently accepted.
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const rawBody = await request.text();

  if (!verifySignature(rawBody, signature, webhookSecret)) {
    return new Response("Invalid signature", { status: 400 });
  }

  let event: { event?: string; payload?: unknown };
  try {
    event = JSON.parse(rawBody) as { event?: string; payload?: unknown };
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  switch (event.event) {
    case "payment.captured":
      // TODO: record captured payment in tip_orders / ledger.
      break;

    case "payment.failed":
      // TODO: mark tip order as failed.
      break;

    default:
      // Unknown events are acknowledged so Razorpay does not retry them.
      break;
  }

  return new Response("OK", { status: 200 });
}
