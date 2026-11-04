import { timingSafeEqual } from "crypto";
import type { LedgerDb } from "@/lib/accrual";
import { getDb } from "@/lib/db";
import { fetchPayment, payuConfig } from "@/lib/payu";
import { expirePasses, reconcilePendingOrders } from "@/lib/plan-orders";

// Daily, run by Vercel Cron (see vercel.json). Two jobs, both safe to repeat, and one never stops
// the other:
//  1. Ask PayU about orders left unsettled (the browser never came back and no notice reached us)
//     and pay, fail or close them out. Skipped when PayU is not set up. It stops after a time
//     budget, newest orders first.
//  2. Take away the features of every pass that has ended, and only the ones the pass added.
// Vercel sends CRON_SECRET as a bearer token.
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Unauthorized", { status: 401 });
  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const match = provided.length === expected.length && timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!match) return new Response("Unauthorized", { status: 401 });

  const sql = getDb();
  if (!sql) return new Response("Not set up", { status: 503 });
  const db = sql as unknown as LedgerDb;

  let checked = "PayU not set up";
  const config = payuConfig();
  if (config) {
    try {
      const r = await reconcilePendingOrders(db, { config, fetchPayment: (txnid) => fetchPayment(config, txnid) });
      checked = `${r.looked} looked at, ${r.activated} paid, ${r.failed} failed, ${r.abandoned} closed out, ${r.stillPending} still open, ${r.unavailable} not answered, ${r.needsLook} to look at by hand, ${r.errors} errors`;
    } catch (err) {
      console.error("Plan orders: the PayU check failed (migration 0055 run?)", err instanceof Error ? err.message : err);
      checked = "the PayU check failed (see the log)";
    }
  }
  let ended = "passes could not be checked (see the log)";
  let failed = true;
  try {
    ended = `${(await expirePasses(db)).expired} passes ended`;
    failed = false;
  } catch (err) {
    console.error("Plan orders: ending passes failed (migration 0055 run?)", err instanceof Error ? err.message : err);
  }
  // A failure is an error status so the owner's cron log shows it.
  return new Response(`${failed ? "ERROR" : "OK"} (${checked}; ${ended})`, { status: failed ? 500 : 200 });
}
