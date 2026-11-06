import { timingSafeEqual } from "crypto";
import type { LedgerDb } from "@/lib/accrual";
import { getDb } from "@/lib/db";
import { sendDailyPayoutEmail } from "@/lib/payout-email";
import { runDailyPayouts } from "@/lib/payout-reminders";

// Every morning, run by Vercel Cron (03:35 UTC, 09:05 IST; see vercel.json). Starts a payout for each
// creator with at least ₹500 available, then emails the owner the list of everything waiting to be
// paid. Safe to repeat: a creator who already has a payout waiting is skipped, so a second call the same
// day starts nothing new and only sends the list again. An email that did not go is not an error
// (tomorrow's run sends again); a failed read is, so the cron log shows it. Vercel sends CRON_SECRET as
// a bearer token.
export const maxDuration = 30;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Unauthorized", { status: 401 });
  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const match = provided.length === expected.length && timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!match) return new Response("Unauthorized", { status: 401 });

  const sql = getDb();
  if (!sql) return new Response("Not set up", { status: 503 });

  try {
    const r = await runDailyPayouts(sql as unknown as LedgerDb, sendDailyPayoutEmail);
    const email = r.waiting === 0 ? "no email needed" : r.off ? "email not set up" : r.sent ? "email sent" : "email not sent";
    const note = `${r.started} started, ${r.waiting} waiting to be paid, ${email}` + (r.errors ? `, ${r.errors} could not be looked at` : "");
    return new Response(r.errors ? `PARTIAL (${note}, see the log)` : `OK (${note})`, { status: r.errors ? 500 : 200 });
  } catch (err) {
    console.error("Daily payouts failed (migration 0059 run?)", err instanceof Error ? err.message : err);
    return new Response("ERROR (the payouts could not be read, see the log)", { status: 500 });
  }
}
