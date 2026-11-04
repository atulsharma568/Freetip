import { timingSafeEqual } from "crypto";
import type { LedgerDb } from "@/lib/accrual";
import { getDb } from "@/lib/db";
import { fetchPayment, payuConfig } from "@/lib/payu";
import { expirePasses, reconcilePendingOrders } from "@/lib/plan-orders";

// Daily, run by Vercel Cron (see vercel.json). Two jobs, both safe to repeat:
//  1. Ask PayU about orders left pending (the browser never came back and no notice reached us)
//     and pay or fail them. Skipped when PayU is not set up.
//  2. Take away the features of every pass that has ended, and only the ones the pass added.
// Vercel sends CRON_SECRET as a bearer token.
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

  const config = payuConfig();
  let checked = "PayU not set up";
  if (config) {
    const r = await reconcilePendingOrders(db, { config, fetchPayment: (txnid) => fetchPayment(config, txnid) });
    checked = `${r.looked} pending looked at, ${r.activated} paid, ${r.failed} failed, ${r.stillPending} still pending, ${r.unavailable} not answered`;
  }
  const e = await expirePasses(db);
  return new Response(`OK (${checked}; ${e.expired} passes ended)`);
}
