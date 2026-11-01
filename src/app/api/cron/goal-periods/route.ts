import { timingSafeEqual } from "crypto";
import { getDb } from "@/lib/db";
import type { Query } from "@/lib/accrual";
import { closeFinishedPeriods } from "@/lib/goal-history";

// Daily, just after midnight in India (see vercel.json): records the day, week or
// month that just ended for every repeating goal bar. The bars reset by themselves
// (they count from the start of the current period); this only keeps the history.
// Vercel sends CRON_SECRET as a bearer token.
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
    const written = await closeFinishedPeriods(sql as unknown as Query);
    return new Response(`OK (${written} periods recorded)`);
  } catch (err) {
    console.error("Goal periods: failed (migration 0028 run?).", err);
    return new Response("Failed", { status: 500 });
  }
}
