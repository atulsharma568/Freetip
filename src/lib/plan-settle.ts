import "server-only";
import type { LedgerDb } from "@/lib/accrual";
import { getDb } from "@/lib/db";
import { fetchPayment, payuConfig, readReply, type PayuPayment } from "@/lib/payu";
import {
  settleCreatorOrders,
  settlePlanPayment,
  settleRazorpayOrder,
  type ReconcileResult,
  type SettleResult,
} from "@/lib/plan-orders";
import { razorpayConfig, razorpayDeps } from "@/lib/razorpay-plan";

// Wires the plan-order rules (plan-orders.ts) to the database, the settings and the gateways: Razorpay
// for every order made since 2026-11-06, PayU only for the older PayU orders (its routes stay so a late
// PayU notice is still understood). Nothing here logs a hash, a salt, a key or a signature, and nothing
// from a request is logged raw (anyone on the internet can post to the PayU routes).

export type SettleOutcome = SettleResult | { status: "not_set_up" };

const MAX_BODY_BYTES = 20_000;

// A value from a request made safe to put in a log line: letters, digits and a few marks only.
export const forLog = (value: string, max = 40): string => value.replace(/[^A-Za-z0-9._-]/g, "?").slice(0, max);

// Reads the request body up to the size cap whatever the headers claim, so a chunked body cannot
// skip it. Null when it is larger.
async function readCapped(request: Request): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

// The text fields of a form post (the kind PayU sends); anything else is ignored. Null when the body
// is not a form or is larger than any real PayU post.
export async function readFormBody(request: Request): Promise<Record<string, string> | null> {
  const type = request.headers.get("content-type") ?? "";
  if (!/application\/x-www-form-urlencoded/i.test(type)) return null;
  const raw = await readCapped(request);
  if (raw === null) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(raw).entries()) out[k] = v;
  return out;
}

// The fields of a JSON body PayU might send, for a payment notice that arrives as JSON instead of a
// form. Strings and numbers only. Null when it is not a JSON object or is too large.
export async function readJsonBody(request: Request): Promise<Record<string, string | number> | null> {
  const raw = await readCapped(request);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const out: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(parsed)) if (typeof v === "string" || typeof v === "number") out[k] = v;
    return out;
  } catch {
    return null;
  }
}

// A PayU reply (the browser return or PayU's notice) for an order made for PayU.
export async function settleFromBody(body: Record<string, unknown>): Promise<SettleOutcome> {
  const config = payuConfig();
  const db = getDb();
  if (!config || !db) return { status: "not_set_up" };
  const reply = readReply(body);
  const result = await settlePlanPayment(db as unknown as LedgerDb, reply, {
    config,
    fetchPayment: (txnid) => fetchPayment(config, txnid),
  });
  const ref = forLog(reply.txnid, 25);
  if (result.status === "rejected") {
    // A hash that does not match may mean PayU signs a layout we do not build; the field names (never
    // their values) help find out.
    const names = result.reason === "bad_hash" ? ` fields: ${forLog(Object.keys(body).sort().join(","), 400)}` : "";
    console.error(`PayU reply not believed: ${result.reason}${result.detail ? ` (${forLog(result.detail, 120)})` : ""} txnid ${ref}.${names}`);
  } else if (result.status === "unavailable") {
    console.error(`PayU could not confirm ${ref}: ${forLog(result.reason, 120)}`);
  }
  return result;
}

// ---- Razorpay ---------------------------------------------------------------------------------

// Settles the plan order behind one Razorpay order. `known` is the payment from a signed webhook (the
// route checked the signature); without it Razorpay's API is asked. Null when this Razorpay order is not
// a plan order (it is a tip), so the webhook carries on with the tip path. Throws only on a database
// error, so the webhook answers 500 and Razorpay sends the event again.
export async function settleRazorpayPlan(providerOrderRef: string, known?: PayuPayment): Promise<SettleOutcome | null> {
  const db = getDb();
  if (!db) return null;
  const ledger = db as unknown as LedgerDb;
  let isPlan: boolean;
  try {
    const [row] = await db<{ one: number }[]>`
      select 1 as one from plan_orders where provider_order_ref = ${providerOrderRef} limit 1
    `;
    isPlan = Boolean(row);
  } catch (err) {
    // Before migration 0060 there can be no Razorpay plan order: this is a tip.
    if ((err as { code?: string }).code === "42703" || (err as { code?: string }).code === "42P01") return null;
    throw err;
  }
  if (!isPlan) return null;
  // A plan order, but the keys are gone: decide nothing, so the sender tries again later.
  const config = razorpayConfig();
  if (!config) return { status: "not_set_up" };
  const result = await settleRazorpayOrder(ledger, providerOrderRef, razorpayDeps(config), known);
  const ref = forLog(providerOrderRef, 40);
  if (result.status === "rejected") {
    console.error(`Razorpay plan payment not believed: ${result.reason}${result.detail ? ` (${forLog(result.detail, 120)})` : ""} order ${ref}.`);
  } else if (result.status === "unavailable") {
    console.error(`Razorpay could not confirm plan order ${ref}: ${forLog(result.reason, 120)}`);
  }
  return result;
}

// ---- A creator's own unsettled orders, on the Paid features page ---------------------------

// How long the page waits for the gateway, per question. The page opens either way; a slow answer only
// means the order is looked at again on the next load (the page refreshes itself while an order is open).
const PAGE_VERIFY_TIMEOUT_MS = 3000;
// One question about the same creator per this long, on this server instance (a brake, not a lock:
// the refresh timer and a reload together would otherwise ask twice in a second).
const PAGE_CHECK_EVERY_MS = 3000;
const lastCheck = new Map<number, number>();

// Asks Razorpay about this creator's pending (and recently failed) orders and settles what Razorpay
// says is paid. Called when the creator opens the plans page, so a payment whose popup reply and
// webhook were both lost is switched on in seconds instead of at the daily job. Never throws and never
// blocks the page for long: any problem is a log line and the page shows what the database says.
export async function settleOwnOrders(creatorId: number): Promise<ReconcileResult | null> {
  try {
    const config = razorpayConfig();
    const db = getDb();
    if (!config || !db) return null;
    const nowMs = Date.now();
    const last = lastCheck.get(creatorId);
    if (last !== undefined && nowMs - last < PAGE_CHECK_EVERY_MS) return null;
    lastCheck.set(creatorId, nowMs);
    if (lastCheck.size > 500) for (const [id, at] of lastCheck) if (nowMs - at > PAGE_CHECK_EVERY_MS) lastCheck.delete(id);
    return await settleCreatorOrders(db as unknown as LedgerDb, creatorId, razorpayDeps(config, PAGE_VERIFY_TIMEOUT_MS));
  } catch (err) {
    console.error("Plans page: could not check the creator's own orders:", err instanceof Error ? err.message : err);
    return null;
  }
}
