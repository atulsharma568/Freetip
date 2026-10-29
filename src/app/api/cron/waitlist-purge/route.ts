import { timingSafeEqual } from "crypto";
import { getDb } from "@/lib/db";

// Daily clean-up, run by Vercel Cron (see vercel.json). Deletes rate-limit
// rows (waitlist, contact form and tips) older than an hour, so hashed IP addresses
// don't linger on days when nobody uses them. Vercel sends CRON_SECRET as a
// bearer token.
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
  if (!sql) return new Response("No database", { status: 503 });
  await sql`delete from waitlist_attempts where created_at < now() - interval '1 hour'`;
  // Table from migration 0011; skip quietly where it hasn't been run yet.
  await sql`delete from contact_attempts where created_at < now() - interval '1 hour'`.catch(() => null);
  // Table from migration 0012; same.
  await sql`delete from tip_order_attempts where created_at < now() - interval '1 hour'`.catch(() => null);
  return new Response("OK");
}
