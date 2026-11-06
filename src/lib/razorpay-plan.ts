import { createHmac, timingSafeEqual } from "node:crypto";
import type { PayuPayment } from "./payu";
import type { GatewayDeps } from "./plan-orders";

// Razorpay for buying a plan: the same account and keys as tips (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET),
// the same checkout popup. Pure on purpose (no database, no `server-only`): the tests run it with made-up
// keys, and the network calls take the fetch function as an argument.
//
// The rules that keep money safe:
//  - The amount is fixed on our side: the Razorpay order is made by our server for the order's price.
//  - Nothing is switched on from what a browser says. The popup's reply is only believed after its
//    signature checks out, and even then our server asks Razorpay's API which payment of that order was
//    captured, and for how much. The webhook's payload is signed with the webhook secret and checked in
//    the webhook route before it gets here.

export type RazorpayMode = "live" | "test";

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  mode: RazorpayMode;
}

// Reads the two keys tips use. Null when either is missing. The mode comes from the key itself
// (rzp_live_... or rzp_test_...), the same rule the tip flow uses.
export function razorpayConfig(env: Record<string, string | undefined> = process.env): RazorpayConfig | null {
  const keyId = env.RAZORPAY_KEY_ID?.trim();
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret, mode: keyId.startsWith("rzp_live_") ? "live" : "test" };
}

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

const auth = (c: RazorpayConfig) => `Basic ${Buffer.from(`${c.keyId}:${c.keySecret}`).toString("base64")}`;

// Constant-time string comparison; false for different lengths.
function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// The popup hands back razorpay_order_id, razorpay_payment_id and razorpay_signature, where the
// signature is HMAC-SHA256("order_id|payment_id", key secret) in hex (Razorpay's documented check).
export function checkoutSignatureIsValid(
  o: { orderId: unknown; paymentId: unknown; signature: unknown },
  keySecret: string,
): boolean {
  if (typeof o.orderId !== "string" || typeof o.paymentId !== "string" || typeof o.signature !== "string") return false;
  if (!/^order_[A-Za-z0-9]{6,40}$/.test(o.orderId) || !/^pay_[A-Za-z0-9]{6,40}$/.test(o.paymentId)) return false;
  const expected = createHmac("sha256", keySecret).update(`${o.orderId}|${o.paymentId}`).digest("hex");
  return safeEqual(o.signature.toLowerCase(), expected);
}

// Makes the Razorpay order for one plan order. `receipt` is our own reference (the plan order's txnid)
// and the notes say what it is, so the order is easy to find in Razorpay's dashboard. Never throws.
export async function createRazorpayOrder(
  config: RazorpayConfig,
  o: { amountMinor: number; receipt: string; planOrderId: number; plan: string; termMonths: number },
  fetchFn: FetchLike = fetch as unknown as FetchLike,
): Promise<{ ok: true; orderId: string } | { ok: false; reason: string }> {
  if (!Number.isSafeInteger(o.amountMinor) || o.amountMinor < 100) return { ok: false, reason: "bad amount" };
  try {
    const res = await fetchFn("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: auth(config), "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: o.amountMinor,
        currency: "INR",
        receipt: o.receipt,
        notes: { kind: "plan", plan_order_id: String(o.planOrderId), plan: o.plan, term_months: String(o.termMonths) },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, reason: `Razorpay answered ${res.status}` };
    const body = (await res.json()) as { id?: unknown; amount?: unknown };
    if (typeof body.id !== "string" || !body.id.startsWith("order_")) return { ok: false, reason: "no order id in the answer" };
    if (body.amount !== o.amountMinor) return { ok: false, reason: "Razorpay made the order for another amount" };
    return { ok: true, orderId: body.id };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message.slice(0, 200) : "request failed" };
  }
}

interface PaymentEntity {
  id?: unknown;
  amount?: unknown;
  currency?: unknown;
  status?: unknown;
  error_description?: unknown;
  error_code?: unknown;
}

// What one Razorpay payment means for a plan order. Only a captured INR payment is paid; a payment
// that is only authorized is not yet (Razorpay captures it by itself when auto-capture is on, as it is
// for tips). The amount is returned as Razorpay reports it, and the caller compares it with the price.
export function readPayment(p: PaymentEntity): PayuPayment {
  const status = typeof p.status === "string" ? p.status : "";
  if (status === "captured") {
    if (typeof p.id !== "string" || !p.id.startsWith("pay_") || !Number.isSafeInteger(p.amount)) {
      return { kind: "unavailable", reason: "captured without a payment id or amount" };
    }
    if (p.currency !== "INR") return { kind: "mismatch", reason: "the payment is not in rupees" };
    return { kind: "success", amountMinor: p.amount as number, payuRef: p.id };
  }
  if (status === "failed") {
    const reason = (typeof p.error_description === "string" && p.error_description) || (typeof p.error_code === "string" && p.error_code) || "payment failed";
    return { kind: "failure", reason: reason.slice(0, 300) };
  }
  // created, authorized, refunded (a refund is the owner's call, handled by hand), or anything new.
  if (status === "refunded") return { kind: "mismatch", reason: "the payment was refunded" };
  return { kind: "pending" };
}

// Reads all payments of one Razorpay order (a creator may fail and retry inside one popup). A captured
// one wins, then one still in progress, then a failure; no payments at all is "not found".
export function readOrderPayments(answer: unknown): PayuPayment {
  if (!answer || typeof answer !== "object") return { kind: "unavailable", reason: "no readable answer" };
  const items = (answer as { items?: unknown }).items;
  if (!Array.isArray(items)) return { kind: "unavailable", reason: "no payment list" };
  const reads = items.filter((x): x is PaymentEntity => !!x && typeof x === "object").map(readPayment);
  if (reads.length === 0) return { kind: "not_found" };
  const rank = ["success", "mismatch", "pending", "unavailable", "failure", "not_found"] as const;
  return reads.sort((x, y) => rank.indexOf(x.kind) - rank.indexOf(y.kind))[0];
}

// The checks plan-orders.ts runs (the daily job, the creator's page load, the Buy form's confirm),
// wired to Razorpay. An order whose Razorpay order was never made has nothing to ask about.
export function razorpayDeps(config: RazorpayConfig, timeoutMs = 8000, fetchFn?: FetchLike): GatewayDeps {
  return {
    provider: "razorpay",
    live: config.mode === "live",
    ask: async (o) => (o.providerOrderRef ? fetchOrderPayment(config, o.providerOrderRef, fetchFn, timeoutMs) : { kind: "not_found" }),
  };
}

// Asks Razorpay about the payments of one order. Never throws: a failure is `unavailable`.
export async function fetchOrderPayment(
  config: RazorpayConfig,
  orderId: string,
  fetchFn: FetchLike = fetch as unknown as FetchLike,
  timeoutMs = 8000,
): Promise<PayuPayment> {
  if (!/^order_[A-Za-z0-9]{6,40}$/.test(orderId)) return { kind: "not_found" };
  try {
    const res = await fetchFn(`https://api.razorpay.com/v1/orders/${orderId}/payments`, {
      method: "GET",
      headers: { Authorization: auth(config) },
      signal: AbortSignal.timeout(timeoutMs),
    });
    // An order id Razorpay does not know (made with the other mode's key, say).
    if (res.status === 400 || res.status === 404) return { kind: "not_found" };
    if (!res.ok) return { kind: "unavailable", reason: `Razorpay answered ${res.status}` };
    return readOrderPayments(await res.json());
  } catch (err) {
    return { kind: "unavailable", reason: err instanceof Error ? err.message.slice(0, 200) : "request failed" };
  }
}
