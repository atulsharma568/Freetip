import type { Query } from "../accrual";
import { HANDLE_PATTERN } from "../waitlist";
import { loadMeterReading, publishedMeter, type MeterPlace, type MeterReading, type MeterSettings } from "./pressure";

// What the two Pressure meter endpoints answer, as plain functions of a database, so the tests
// run them against an in-memory Postgres and the route files stay thin. Read-only. A creator who
// is not active, a switch turned off, a hidden meter and a meter set for the other place all give
// the same answer, "none" (the route says 404): nothing tells a caller which of them it was.

type Row = { id: string; paid_features: string[] | null; page_published: unknown };

export type MeterAnswer =
  | { found: false }
  // `reading` is null while the creator has no goal; the meter then draws nothing.
  | { found: true; reading: MeterReading | null; settings: MeterSettings };

async function answer(row: Row | undefined, place: MeterPlace, db: Query, now: Date): Promise<MeterAnswer> {
  const settings = publishedMeter(row, place);
  if (!row || !settings) return { found: false };
  return { found: true, reading: await loadMeterReading(db, Number(row.id), settings, now), settings };
}

// The tip page's meter: by the creator's handle. The caller has already lower-cased it.
export async function meterForHandle(db: Query, handle: string, now = new Date()): Promise<MeterAnswer> {
  if (!HANDLE_PATTERN.test(handle)) return { found: false };
  const [row] = await db<Row[]>`
    select id, paid_features, page_published from users where handle = ${handle} and creator_status = 'active'
  `;
  return answer(row, "page", db, now);
}

// The OBS meter: by the hash of the creator's secret overlay token.
export async function meterForToken(db: Query, tokenHash: string, now = new Date()): Promise<MeterAnswer> {
  const [row] = await db<Row[]>`
    select id, paid_features, page_published from users where overlay_token_hash = ${tokenHash} and creator_status = 'active'
  `;
  return answer(row, "obs", db, now);
}

// What a fan's browser receives: the reading only (the words and colours are in the page).
export function pageBody(a: Extract<MeterAnswer, { found: true }>) {
  return { meter: a.reading };
}

// What OBS receives: the reading and the few settings the bar needs.
export function obsBody(a: Extract<MeterAnswer, { found: true }>) {
  const { heading, fill, celebrate, show } = a.settings;
  return { meter: a.reading, settings: { heading, fill, celebrate, show } };
}
