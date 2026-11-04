import { timingSafeEqual } from "crypto";
import type { LedgerDb } from "@/lib/accrual";
import { getDb } from "@/lib/db";
import { fetchPayment, payuConfig } from "@/lib/payu";
import { sendPassReminderEmail } from "@/lib/pass-email";
import { sendPassReminders } from "@/lib/pass-reminders";
import { expirePasses, reconcilePendingOrders, syncRunningPasses } from "@/lib/plan-orders";

// Daily, run by Vercel Cron (see vercel.json). Three jobs, all safe to repeat, and one never stops
// the others:
//  1. Ask PayU about orders left unsettled (the browser never came back and no notice reached us)
//     and pay, fail or close them out. Skipped when PayU is not set up. It stops after a time
//     budget, newest orders first.
//  2. Take away the features of every pass that has ended, and only the ones the pass added.
//  3. Give every running plan the features it lists today (a feature added to a plan after it was bought).
//  4. Email creators whose pass ends within 5 days, once per end date (off until the sender is set up).
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
  // A plan whose feature list grew since it was bought. Not a failure of the run if it cannot be done.
  let synced = "feature sync failed (see the log)";
  try {
    synced = `${(await syncRunningPasses(db)).synced} plans got new features`;
  } catch (err) {
    console.error("Plan orders: adding new plan features failed (migration 0057 run?)", err instanceof Error ? err.message : err);
  }
  // A reminder that could not be sent is not a failure of the run: the next run tries again.
  let reminded = "reminders could not be sent (see the log)";
  try {
    const r = await sendPassReminders(db, sendPassReminderEmail);
    reminded = r.off ? "reminders off (no email sender set up)" : `${r.sent} reminders sent${r.failed ? `, ${r.failed} not sent` : ""}`;
  } catch (err) {
    console.error("Plan orders: reminders failed", err instanceof Error ? err.message : err);
  }
  // A failure is an error status so the owner's cron log shows it.
  return new Response(`${failed ? "ERROR" : "OK"} (${checked}; ${ended}; ${synced}; ${reminded})`, { status: failed ? 500 : 200 });
}
