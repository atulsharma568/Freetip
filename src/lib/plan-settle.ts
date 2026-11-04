import "server-only";
import type { LedgerDb } from "@/lib/accrual";
import { getDb } from "@/lib/db";
import { fetchPayment, payuConfig, readReply } from "@/lib/payu";
import { settlePlanPayment, type SettleResult } from "@/lib/plan-orders";

// Turns a form body PayU posted (the browser return or the webhook) into a settled order. The
// rules are in plan-orders.ts; this only wires in the database, the settings and PayU's check.
// Nothing here logs the hash, the salt or the key.

export type SettleOutcome = SettleResult | { status: "not_set_up" };

const MAX_BODY_BYTES = 20_000;

// The text fields of a form post; anything else is ignored. Null when the body is not a form or is
// larger than any real PayU post.
export async function readFormBody(request: Request): Promise<Record<string, string> | null> {
  const type = request.headers.get("content-type") ?? "";
  if (!/application\/x-www-form-urlencoded|multipart\/form-data/i.test(type)) return null;
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) return null;
  try {
    const form = await request.formData();
    const out: Record<string, string> = {};
    for (const [k, v] of form.entries()) if (typeof v === "string") out[k] = v;
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
  if (result.status === "rejected") console.error("PayU reply not believed:", result.reason, "txnid", reply.txnid.slice(0, 25));
  else if (result.status === "unavailable") console.error("PayU could not be asked about", reply.txnid.slice(0, 25), result.reason);
  return result;
}
