import { timingSafeEqual } from "crypto";
import { getDb } from "@/lib/db";
import type { LedgerDb } from "@/lib/accrual";
import { realStreamlabsDeps, streamlabsConfigured } from "@/lib/streamlabs";
import { processOutbox } from "@/lib/streamlabs-outbox";

// Sends the Streamlabs alerts that are still queued: ones that were waiting for the
// creator to approve a message, were held back to stay under Streamlabs' rate advice, or
// failed and are due a retry. Each tip is also tried straight after it is captured, so this
// only catches the rest. Safe to call as often as wanted (each row is leased before it is
// sent); the daily entry in vercel.json is a safety net, and a scheduler sending the
// CRON_SECRET bearer token every minute or two keeps waiting alerts timely (OPERATIONS.md).
export const maxDuration = 120;

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
  if (!streamlabsConfigured()) return Response.json({ configured: false });

  try {
    const summary = await processOutbox(sql as unknown as LedgerDb, realStreamlabsDeps(), 40);
    return Response.json({ configured: true, ...summary });
  } catch (err) {
    console.error("streamlabs-outbox failed (migration 0041 run?)", err);
    return new Response("Failed", { status: 500 });
  }
}
