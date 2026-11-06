import type { getDb } from "@/lib/db";

// Owner settings for the whole site, kept in the site_settings table (migration 0043).
// Pure helpers first so the rules are testable without a database.

// The smallest tip whose message may be read aloud, whatever the creator chose. The
// owner changes it in /admin/settings; until a value is saved it is ₹50.
export const DEFAULT_TTS_FLOOR_PAISE = 5000;
export const TTS_FLOOR_MAX_PAISE = 1_000_000;
export const TTS_FLOOR_KEY = "tts_floor_paise";

// The creator's own "read aloud from" amount, but never below the owner's floor.
export function effectiveTtsMinPaise(creatorMinPaise: number, floorPaise: number): number {
  return Math.max(creatorMinPaise, floorPaise);
}

// The owner types whole rupees. 0 turns the floor off (the creator's own amount rules).
export function parseFloorRupees(raw: unknown): number | null {
  const text = typeof raw === "number" ? String(raw) : String(raw ?? "").trim();
  const n = /^\d{1,5}$/.test(text) ? Number(text) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > TTS_FLOOR_MAX_PAISE / 100) return null;
  return n;
}

type Db = NonNullable<ReturnType<typeof getDb>>;

// The owner's voice floor in paise. A missing table or row means the default, so the
// floor still holds before the migration is run.
export async function getTtsFloorPaise(db: Db | null): Promise<number> {
  if (!db) return DEFAULT_TTS_FLOOR_PAISE;
  try {
    const [row] = await db<{ value: string }[]>`select value from site_settings where key = ${TTS_FLOOR_KEY}`;
    if (!row) return DEFAULT_TTS_FLOOR_PAISE;
    const n = parseInt(row.value, 10);
    return Number.isInteger(n) && n >= 0 && n <= TTS_FLOOR_MAX_PAISE ? n : DEFAULT_TTS_FLOOR_PAISE;
  } catch {
    return DEFAULT_TTS_FLOOR_PAISE;
  }
}

// Where the owner's emails go: the contact-form messages and the morning "pay these creators" list.
// The owner changes it in /admin/settings; until one is saved the CONTACT_NOTIFY_EMAIL setting in
// Vercel is used, so nothing changes for a site that already has it.
export const NOTIFY_EMAIL_KEY = "notify_email";

// One plain address: no spaces, commas, semicolons or line breaks (so it can never become a second
// recipient or a header), one @, a dotted domain, at most 254 characters. Returns the address in lower
// case, or null when it is not acceptable.
export function parseNotifyEmail(raw: unknown): string | null {
  const text = String(raw ?? "").trim().toLowerCase();
  if (text.length < 6 || text.length > 254) return null;
  return /^[a-z0-9._%+-]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(text) ? text : null;
}

// For the audit history, which should not keep a full address: "a***@gmail.com".
export function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  return at < 1 ? "***" : `${email[0]}***${email.slice(at)}`;
}

// The saved address, or null when none is saved (or the table is missing).
export async function getSavedNotifyEmail(db: Db | null): Promise<string | null> {
  if (!db) return null;
  try {
    const [row] = await db<{ value: string }[]>`select value from site_settings where key = ${NOTIFY_EMAIL_KEY}`;
    return row ? parseNotifyEmail(row.value) : null;
  } catch {
    return null;
  }
}

// The address the owner's emails go to now: the saved one, else CONTACT_NOTIFY_EMAIL, else null (email off).
export async function getNotifyEmail(db: Db | null): Promise<string | null> {
  return (await getSavedNotifyEmail(db)) ?? (process.env.CONTACT_NOTIFY_EMAIL?.trim() || null);
}
