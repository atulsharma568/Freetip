import { timingSafeEqual } from "crypto";
import type { LedgerDb } from "@/lib/accrual";
import { getDb } from "@/lib/db";
import { sendPayoutNudgeEmail } from "@/lib/payout-email";
import { sendPayoutNudge } from "@/lib/payout-reminders";

// Daily, run by Vercel Cron (see vercel.json). Emails the owner when a payout request has waited
// 3 days or more. Safe to repeat. An email that did not go is not an error (tomorrow's run tries
// again); a failed read of the requests is, so the cron log shows it. Vercel sends CRON_SECRET as a
// bearer token.
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
    const r = await sendPayoutNudge(sql as unknown as LedgerDb, sendPayoutNudgeEmail);
    const note = r.waiting === 0 ? "nothing waiting" : r.off ? `${r.waiting} waiting, email not set up` : r.sent ? `${r.waiting} waiting, email sent` : `${r.waiting} waiting, email not sent`;
    return new Response(`OK (${note})`);
  } catch (err) {
    console.error("Payout reminder failed (migration 0059 run?)", err instanceof Error ? err.message : err);
    return new Response("ERROR (the payout requests could not be read, see the log)", { status: 500 });
  }
}
