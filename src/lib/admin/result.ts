// A read that can fail, kept apart from a read that found nothing. Before this the
// admin helpers turned every database error into zeros or an empty list, so a SQL
// fault (a missing column, a migration not run) looked exactly like "no data".
//
// No site imports and no `server-only`, so the tests can run the helpers against
// an in-memory Postgres.

import { toPaise } from "../money";

// A whole number the database sent back as text (a count, an id or an amount in
// paise): parsed once, here, and refused if it is not a whole number.
export const toWhole = toPaise;

export type Loaded<T> = { ok: true; data: T } | { ok: false; error: string };

export async function load<T>(what: string, read: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await read() };
  } catch (err) {
    console.error(`Admin: could not read ${what}`, err);
    return { ok: false, error: err instanceof Error ? err.message.slice(0, 300) : "Unknown error" };
  }
}

// What the owner reads on a page when a read fails.
export const COULD_NOT_READ = "Could not read this data. Has migration 0023 been run?";

// A signed amount of paise as rupees. A negative amount keeps its minus sign: a
// creator who is owed less than nothing must be visible, never rounded up to zero.
export function formatINR(minor: number): string {
  const rupees = minor / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}
