import "server-only";
import type { LedgerDb } from "@/lib/accrual";
import { getDb } from "@/lib/db";
import { fetchPayment, payuConfig, readReply } from "@/lib/payu";
import { settleCreatorOrders, settlePlanPayment, type ReconcileResult, type SettleResult } from "@/lib/plan-orders";

// Turns a form body PayU posted (the browser return or the webhook) into a settled order. The
// rules are in plan-orders.ts; this only wires in the database, the settings and PayU's check.
// Nothing here logs the hash, the salt or the key, and nothing from a request is logged raw
// (anyone on the internet can post here).

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

// ---- A creator's own unsettled orders, on the Paid features page ---------------------------

// How long the page waits for PayU, per question. The page opens either way; a slow PayU only means
// the order is looked at again on the next load (the page refreshes itself while an order is open).
const PAGE_VERIFY_TIMEOUT_MS = 3000;
// One question about the same creator per this long, on this server instance (a brake, not a lock:
// the refresh timer and a reload together would otherwise ask PayU twice in a second).
const PAGE_CHECK_EVERY_MS = 3000;
const lastCheck = new Map<number, number>();

// Asks PayU about this creator's pending (and recently failed) orders and settles what PayU says is
// paid. Called when the creator opens the plans page, so a payment whose browser return and notice
// were both lost is switched on in seconds instead of at the daily job. Never throws and never
// blocks the page for long: any problem is a log line and the page shows what the database says.
export async function settleOwnOrders(creatorId: number): Promise<ReconcileResult | null> {
  try {
    const config = payuConfig();
    const db = getDb();
    if (!config || !db) return null;
    const nowMs = Date.now();
    const last = lastCheck.get(creatorId);
    if (last !== undefined && nowMs - last < PAGE_CHECK_EVERY_MS) return null;
    lastCheck.set(creatorId, nowMs);
    if (lastCheck.size > 500) for (const [id, at] of lastCheck) if (nowMs - at > PAGE_CHECK_EVERY_MS) lastCheck.delete(id);
    return await settleCreatorOrders(db as unknown as LedgerDb, creatorId, {
      config,
      fetchPayment: (txnid) => fetchPayment(config, txnid, undefined, PAGE_VERIFY_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("Plans page: could not check the creator's own orders:", err instanceof Error ? err.message : err);
    return null;
  }
}
