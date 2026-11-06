import { timingSafeEqual } from "crypto";
import type { LedgerDb } from "@/lib/accrual";
import { getDb } from "@/lib/db";
import { fetchPayment, payuConfig } from "@/lib/payu";
import { sendPassReminderEmail } from "@/lib/pass-email";
import { sendPassReminders } from "@/lib/pass-reminders";
import { expirePasses, reconcilePendingOrders, syncRunningPasses } from "@/lib/plan-orders";
import { razorpayConfig, razorpayDeps } from "@/lib/razorpay-plan";

// Daily, run by Vercel Cron (see vercel.json). Four jobs, all safe to repeat, and one never stops
// the others:
//  1. Ask Razorpay (and PayU, while its keys are set) about orders left unsettled (the popup's reply
//     and the webhook both lost) and pay, fail or close them out. It stops after a time budget, newest
//     orders first.
//  2. Take away the features of every pass that has ended, and only the ones the pass added.
//  3. Give every running plan the features it lists today (a feature added to a plan after it was bought).
//  4. Email creators whose pass ends within 5 days, once per end date (off until the sender is set up).
// Jobs 1 to 3 touch money or access: if any of them throws or leaves one creator undone, the answer is
// ERROR (status 500) so the cron log shows it. A reminder email that did not go is not an error: the
// next run tries again. Vercel sends CRON_SECRET as a bearer token.
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

  // Set by any step of jobs 1 to 3 that failed or left something undone, so the run is not reported OK.
  let failed = false;

  // Razorpay for every order made since 2026-11-06; PayU only while its keys are still set, for older
  // PayU orders. Each gateway is asked only about its own orders.
  const describe = (name: string, r: Awaited<ReturnType<typeof reconcilePendingOrders>>) =>
    `${name}: ${r.looked} looked at, ${r.activated} paid, ${r.failed} failed, ${r.abandoned} closed out, ${r.stillPending} still open, ${r.unavailable} not answered, ${r.needsLook} to look at by hand, ${r.errors} errors`;
  const checks: string[] = [];
  const rzp = razorpayConfig();
  if (rzp) {
    try {
      const r = await reconcilePendingOrders(db, razorpayDeps(rzp), { budgetMs: 20_000 });
      checks.push(describe("Razorpay", r));
      if (r.errors > 0) failed = true;
    } catch (err) {
      console.error("Plan orders: the Razorpay check failed (migration 0060 run?)", err instanceof Error ? err.message : err);
      checks.push("the Razorpay check failed (see the log)");
      failed = true;
    }
  } else checks.push("Razorpay not set up");
  const config = payuConfig();
  if (config) {
    try {
      const r = await reconcilePendingOrders(db, { config, fetchPayment: (txnid) => fetchPayment(config, txnid) }, { budgetMs: 15_000 });
      checks.push(describe("PayU", r));
      if (r.errors > 0) failed = true;
    } catch (err) {
      console.error("Plan orders: the PayU check failed (migration 0060 run?)", err instanceof Error ? err.message : err);
      checks.push("the PayU check failed (see the log)");
      failed = true;
    }
  }
  const checked = checks.join("; ");
  let ended = "passes could not be checked (see the log)";
  try {
    const r = await expirePasses(db);
    ended = `${r.expired} passes ended${r.failed ? `, ${r.failed} could not be switched off (see the log)` : ""}`;
    if (r.failed > 0) failed = true;
  } catch (err) {
    console.error("Plan orders: ending passes failed (migration 0055 run?)", err instanceof Error ? err.message : err);
    failed = true;
  }
  // A plan whose feature list grew since it was bought: a creator who paid for it is missing a feature.
  let synced = "feature sync failed (see the log)";
  try {
    synced = `${(await syncRunningPasses(db)).synced} plans got new features`;
  } catch (err) {
    console.error("Plan orders: adding new plan features failed (migration 0057 run?)", err instanceof Error ? err.message : err);
    failed = true;
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
