import { getDb } from "@/lib/db";

// Daily clean-up, run by Vercel Cron (see vercel.json). Deletes rate-limit
// rows older than an hour, so hashed IP addresses don't linger on days when
// nobody joins the waitlist. Vercel sends CRON_SECRET as a bearer token.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const sql = getDb();
  if (!sql) return new Response("No database", { status: 503 });
  await sql`delete from waitlist_attempts where created_at < now() - interval '1 hour'`;
  return new Response("OK");
}
