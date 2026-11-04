import { timingSafeEqual } from "crypto";
import { getDb } from "@/lib/db";
import { purgeHandledContactMessages, purgeOldFanProfiles, purgeOldPlanOrders, purgeOldTimestamps, purgeOldTipText } from "@/lib/retention";
import type { LedgerDb } from "@/lib/accrual";

// Daily clean-up, run by Vercel Cron (see vercel.json): blanks the name and message
// on tips older than 90 days and deletes handled contact messages older than 12
// months, stream timestamps older than 90 days, and plan orders (never paid: 12 months; paid: 8 years), as the privacy policy says. Vercel sends CRON_SECRET
// as a bearer token.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Unauthorized", { status: 401 });

  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const match =
    provided.length === expected.length &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!match) return new Response("Unauthorized", { status: 401 });

  const sql = getDb();
  if (!sql) return new Response("Not set up", { status: 503 });

  try {
    const ledgerDb = sql as unknown as LedgerDb;
    const { cleared } = await purgeOldTipText(ledgerDb);
    const { deleted } = await purgeHandledContactMessages(ledgerDb);
    // Apart, so a missing migration 0032 does not stop the two purges above.
    let timestampsDeleted = 0;
    try {
      timestampsDeleted = (await purgeOldTimestamps(ledgerDb)).deleted;
    } catch (err) {
      console.error("tip-text-purge: timestamps purge failed (migration 0032 run?)", err);
    }
    // Apart as well: a missing migration 0038 only skips the 12-month fan profile purge.
    let fansDeleted = 0;
    try {
      fansDeleted = (await purgeOldFanProfiles(ledgerDb)).deleted;
    } catch (err) {
      console.error("tip-text-purge: fan profile purge failed (migration 0038 run?)", err);
    }
    // Apart as well: a missing migration 0055 only skips the plan order purge.
    let plansPurged = { unpaid: 0, paid: 0 };
    try {
      plansPurged = await purgeOldPlanOrders(ledgerDb);
    } catch (err) {
      console.error("tip-text-purge: plan order purge failed (migration 0055 run?)", err);
    }
    return Response.json({ cleared, contactDeleted: deleted, timestampsDeleted, fansDeleted, planOrdersDeleted: plansPurged });
  } catch (err) {
    console.error("tip-text-purge failed", err);
    return new Response("Failed", { status: 500 });
  }
}
