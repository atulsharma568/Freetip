import "server-only";
import { getDb } from "@/lib/db";
import type { LedgerDb } from "@/lib/accrual";

// The database for the owner's pages, typed for the helpers in this folder, or
// null when DATABASE_URL is not set (the pages then say the data is not set up).
// postgres.js is called as a tagged template and has `begin`, which is all
// `LedgerDb` asks for, so the cast only narrows the type.
export function adminDb(): LedgerDb | null {
  const db = getDb();
  return db ? (db as unknown as LedgerDb) : null;
}
