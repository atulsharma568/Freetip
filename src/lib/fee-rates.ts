import type { Query } from "./accrual";
import {
  MAX_PLATFORM_BPS,
  MAX_PROCESSING_BPS,
  STANDARD_RATES,
  checkRates,
  splitTip,
  type FeeRates,
} from "./money";

// The owner's fee rates (2026-11-03). Three layers, the nearest one wins:
//   1. the standard rates in `money.ts` (5% and 3%), used when nothing is saved;
//   2. the site-wide rates the owner saves in /admin/fees (site_settings), which every
//      creator follows unless they have their own;
//   3. a creator's own pair (users.platform_bps_override and processing_bps_override),
//      set in the creator's page or in bulk. Both numbers or neither: a creator either
//      follows the site rates or has their own pair.
// The pair a tip is charged at is copied onto the order when it is created, so a change here
// only ever reaches tips made after it. No site imports, so the tests can run all of it
// against an in-memory Postgres.

export const FEE_PLATFORM_KEY = "fee_platform_bps";
export const FEE_PROCESSING_KEY = "fee_processing_bps";

// What the owner types is a percentage with up to two decimals ("5", "2.75", "0", "4.5%").
// Returns whole basis points, or null for anything else or anything above `maxBps`.
export function parsePercent(raw: unknown, maxBps: number): number | null {
  const text = (typeof raw === "number" ? String(raw) : String(raw ?? "")).trim().replace(/\s*%$/, "");
  const m = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(text);
  if (!m) return null;
  const bps = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || "0");
  return bps <= maxBps ? bps : null;
}

export type ParsedRates = { ok: true; rates: FeeRates } | { ok: false; error: string };

// Both boxes of a rate form. The message says which box is wrong and what is allowed.
export function parseRates(platformRaw: unknown, processingRaw: unknown): ParsedRates {
  const platformBps = parsePercent(platformRaw, MAX_PLATFORM_BPS);
  if (platformBps === null) {
    return { ok: false, error: `The platform fee must be a percentage from 0 to ${MAX_PLATFORM_BPS / 100}, with at most two decimals.` };
  }
  const processingBps = parsePercent(processingRaw, MAX_PROCESSING_BPS);
  if (processingBps === null) {
    return { ok: false, error: `The processing charge must be a percentage from 0 to ${MAX_PROCESSING_BPS / 100}, with at most two decimals.` };
  }
  return { ok: true, rates: { platformBps, processingBps } };
}

// 500 -> "5", 275 -> "2.75", 450 -> "4.5", 0 -> "0".
export function formatPercent(bps: number): string {
  return String(bps / 100);
}

export const sameRates = (a: FeeRates, b: FeeRates) =>
  a.platformBps === b.platformBps && a.processingBps === b.processingBps;

// "5% + 3%", or "no fees" when both are nothing.
export function describeRates(r: FeeRates): string {
  if (r.platformBps === 0 && r.processingBps === 0) return "no fees";
  return `${formatPercent(r.platformBps)}% + ${formatPercent(r.processingBps)}%`;
}

// The sentence the creator's dashboard uses for what the "you'd keep" figure leaves out, in the
// creator's own rates ("each tip less our 5% fee and the 3% processing charge").
export function estimateNote(r: FeeRates): string {
  const parts = [
    r.platformBps > 0 ? `our ${formatPercent(r.platformBps)}% fee` : null,
    r.processingBps > 0 ? `the ${formatPercent(r.processingBps)}% processing charge` : null,
  ].filter((p): p is string => p !== null);
  return parts.length === 0 ? "your tips carry no fee, so it is each tip in full" : `each tip less ${parts.join(" and ")}`;
}

// What a creator keeps of a ₹100 tip under a pair, whole rupees and paise, for the owner's
// forms ("₹92.25"). Worked by the same rule as every real tip.
export function keepOfHundred(r: FeeRates): string {
  return `₹${(splitTip(10000, r).creatorSharePaise / 100).toFixed(2)}`;
}

// A saved setting from the audit history ({mode:"site"} or {mode:"own", platformBps, processingBps}), in words.
export function describeSetting(json: unknown): string {
  const j = json as { mode?: string; platformBps?: unknown; processingBps?: unknown } | null;
  if (j?.mode === "site") return "the site rates";
  if (j?.mode === "own" && typeof j.platformBps === "number" && typeof j.processingBps === "number") {
    return `own rates, ${describeRates({ platformBps: j.platformBps, processingBps: j.processingBps })}`;
  }
  return "unknown";
}

// A creator's own pair, or null when they follow the site rates.
export type RateOverride = FeeRates | null;

export function overrideFromRow(row: { platform_bps_override: number | null; processing_bps_override: number | null } | undefined): RateOverride {
  if (!row || row.platform_bps_override === null || row.processing_bps_override === null) return null;
  try {
    return checkRates({ platformBps: row.platform_bps_override, processingBps: row.processing_bps_override });
  } catch {
    return null;
  }
}

export const effectiveRates = (site: FeeRates, override: RateOverride): FeeRates => override ?? site;

const undefinedColumn = (err: unknown) => (err as { code?: string })?.code === "42703";
const undefinedTable = (err: unknown) => (err as { code?: string })?.code === "42P01";

// The site-wide pair. A part that is missing or not a valid number is the standard rate, so a
// bad row can never charge anything odd; a missing table (migration 0043) is all standard.
export async function getSiteRates(db: Query): Promise<FeeRates> {
  let rows: { key: string; value: string }[] = [];
  try {
    rows = await db<{ key: string; value: string }[]>`
      select key, value from site_settings where key in (${FEE_PLATFORM_KEY}, ${FEE_PROCESSING_KEY})
    `;
  } catch (err) {
    if (!undefinedTable(err)) throw err;
  }
  const part = (key: string, max: number, fallback: number) => {
    const n = Number(rows.find((r) => r.key === key)?.value);
    return Number.isInteger(n) && n >= 0 && n <= max ? n : fallback;
  };
  return {
    platformBps: part(FEE_PLATFORM_KEY, MAX_PLATFORM_BPS, STANDARD_RATES.platformBps),
    processingBps: part(FEE_PROCESSING_KEY, MAX_PROCESSING_BPS, STANDARD_RATES.processingBps),
  };
}

export interface CreatorRates {
  effective: FeeRates;
  site: FeeRates;
  override: RateOverride;
}

// What one creator is charged from now on. Before migration 0054 there is no override column, so
// nobody can have one: the site rates apply (this is only ever hit while the migration is pending).
export async function getCreatorRates(db: Query, creatorId: number): Promise<CreatorRates> {
  const site = await getSiteRates(db);
  let override: RateOverride = null;
  try {
    const [row] = await db<{ platform_bps_override: number | null; processing_bps_override: number | null }[]>`
      select platform_bps_override, processing_bps_override from users where id = ${creatorId}
    `;
    override = overrideFromRow(row);
  } catch (err) {
    if (!undefinedColumn(err)) throw err;
  }
  return { effective: effectiveRates(site, override), site, override };
}
