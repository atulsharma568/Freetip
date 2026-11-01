import { timingSafeEqual } from "crypto";
import { getDb } from "@/lib/db";
import type { LedgerDb } from "@/lib/accrual";
import { postDueComments, purgeRateRows, realDeps } from "@/lib/stream-timestamps";
import { createYouTubeClient, youtubeConfigured } from "@/lib/youtube";

// Posts one comment with all the saved timestamps on each stream that has ended, from
// the creator's own YouTube account. Safe to call as often as wanted (a stream still
// live is left alone, and each stream is claimed before it is posted), so besides the
// daily entry in vercel.json it can be called every few minutes by any scheduler that
// sends the CRON_SECRET bearer token (see OPERATIONS.md).
export const maxDuration = 300;

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
  if (!youtubeConfigured()) return Response.json({ configured: false });

  try {
    const db = sql as unknown as LedgerDb;
    const summary = await postDueComments(db, realDeps(createYouTubeClient()));
    const rateRowsDeleted = await purgeRateRows(db);
    return Response.json({ configured: true, ...summary, rateRowsDeleted });
  } catch (err) {
    console.error("stream-timestamps failed (migration 0032 run?)", err);
    return new Response("Failed", { status: 500 });
  }
}
