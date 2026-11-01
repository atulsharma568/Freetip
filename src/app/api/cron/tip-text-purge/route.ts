import { timingSafeEqual } from "crypto";
import { getDb } from "@/lib/db";
import { purgeHandledContactMessages, purgeOldTimestamps, purgeOldTipText } from "@/lib/retention";
import type { LedgerDb } from "@/lib/accrual";

// Daily clean-up, run by Vercel Cron (see vercel.json): blanks the name and message
// on tips older than 90 days and deletes handled contact messages older than 12
// months, and stream timestamps older than 90 days, as the privacy policy says. Vercel sends CRON_SECRET
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
    return Response.json({ cleared, contactDeleted: deleted, timestampsDeleted });
  } catch (err) {
    console.error("tip-text-purge failed", err);
    return new Response("Failed", { status: 500 });
  }
}
