import { timingSafeEqual } from "crypto";
import { getDb } from "@/lib/db";

// Daily clean-up, run by Vercel Cron (see vercel.json): removes cached voice clips
// not played for 30 days and usage rows older than 90 days. Vercel sends
// CRON_SECRET as a bearer token.
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
    const clips = await sql`delete from tts_cache where last_used_at < now() - interval '30 days' returning hash`;
    const usage = await sql`delete from tts_usage where day < current_date - 90 returning day`;
    return new Response(`OK (${clips.length} clips, ${usage.length} usage rows removed)`);
  } catch {
    // The tables from migration 0019 are missing: nothing to clean.
    return new Response("OK (no tts tables)");
  }
}
