import type { Query } from "../accrual";
import { HANDLE_PATTERN } from "../waitlist";
import { usableFor } from "./assets";
import { resolveAssets } from "./asset-store";
import { loadMeterReading, publishedMeter, type MeterPlace, type MeterReading, type MeterSettings } from "./pressure";

// What the two Pressure meter endpoints answer, as plain functions of a database, so the tests
// run them against an in-memory Postgres and the route files stay thin. Read-only. A creator who
// is not active, a switch turned off, a hidden meter and a meter set for the other place all give
// the same answer, "none" (the route says 404): nothing tells a caller which of them it was.

type Row = { id: string; paid_features: string[] | null; page_published: unknown };

export type MeterAnswer =
  | { found: false }
  // `reading` is null while the creator has no goal; the meter then draws nothing.
  // `picture` is the address of the meter's emblem for the OBS place only (null when there is none,
  // it was removed or taken down, or it is the wrong kind), so the tip page answer never carries it.
  | { found: true; reading: MeterReading | null; settings: MeterSettings; picture: string | null };

// The emblem's file address, or null. A missing table (migration 0052 not run) or any failure
// gives null: the bar is drawn without a picture rather than not at all.
async function emblemUrl(db: Query, creatorId: number, settings: MeterSettings): Promise<string | null> {
  if (settings.picture === null) return null;
  try {
    const asset = (await resolveAssets(db, creatorId, [settings.picture]))[settings.picture];
    return asset && usableFor(asset.kind, "meter") ? asset.url : null;
  } catch (err) {
    console.error("Pressure overlay: could not read the meter picture.", err);
    return null;
  }
}

async function answer(row: Row | undefined, place: MeterPlace, db: Query, now: Date): Promise<MeterAnswer> {
  const settings = publishedMeter(row, place);
  if (!row || !settings) return { found: false };
  const reading = await loadMeterReading(db, Number(row.id), settings, now);
  const picture = place === "obs" && reading ? await emblemUrl(db, Number(row.id), settings) : null;
  return { found: true, reading, settings, picture };
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

// What OBS receives: the reading, the few settings the bar needs and the emblem's address.
export function obsBody(a: Extract<MeterAnswer, { found: true }>) {
  const { heading, fill, celebrate, show } = a.settings;
  return { meter: a.reading, settings: { heading, fill, celebrate, show, picture: a.picture } };
}
