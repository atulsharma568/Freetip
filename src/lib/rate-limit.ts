import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import type { getDb } from "@/lib/db";

type Db = NonNullable<ReturnType<typeof getDb>>;

// The three per-network hourly limits (contact form, waitlist, tips started). Each table
// holds one row per counted attempt: `ip_hash` is an HMAC of the address, never the
// address, and rows are only needed for an hour.
export type AttemptTable = "contact_attempts" | "waitlist_attempts" | "tip_order_attempts";

// The visitor's address as the host reports it, or null when it reports none. Vercel sets
// both headers itself and overwrites any a visitor sends.
export async function clientIp(): Promise<string | null> {
  const list = await headers();
  return list.get("x-real-ip")?.trim() || list.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

export function ipKey(ip: string, salt: string): string {
  return createHmac("sha256", salt).update(ip).digest("hex");
}

// Counts one attempt for this network and says whether it is allowed (`limit` per hour).
// One request per network at a time: without the lock a burst would all read the count
// before any of it was recorded and every one would pass. A refused attempt is not
// recorded, so a flood cannot keep real users on the same address locked out past the hour.
export async function takeAttempt(db: Db, table: AttemptTable, key: string, limit: number): Promise<boolean> {
  return db.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
    const [{ recent }] = await tx<{ recent: number }[]>`
      select count(*)::int as recent from ${tx(table)}
      where ip_hash = ${key} and created_at > now() - interval '1 hour'
    `;
    if (recent >= limit) return false;
    await tx`insert into ${tx(table)} (ip_hash) values (${key})`;
    await tx`delete from ${tx(table)} where created_at < now() - interval '1 hour'`;
    return true;
  });
}

// For the contact and waitlist forms: visitors with no reported address share one "unknown"
// count, so that count gets ten times the limit instead of locking everyone out after a few
// tries.
export function limitFor(ip: string | null, limit: number): number {
  return ip ? limit : limit * 10;
}
