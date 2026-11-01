import { MIN_TIP_PAISE } from "./money";
import { findBlockedWord } from "./message-filter";

// Paid highlighted messages (code name "pinned"): a fan who tips at least the creator's
// pin minimum can have their message pinned on stream for a while. Priced as a minimum
// tip, never an extra fee. The creator always approves the message first (even in instant
// mode), can take it down at any time, and the tip stays final either way.
//
// Pure rules live here so they are testable without a database.

export const PIN_SECONDS_MIN = 10;
export const PIN_SECONDS_MAX = 120;
export const PIN_SECONDS_DEFAULT = 30;
// A message can be pinned again by the creator for this long after the tip was paid.
export const PIN_AGAIN_WINDOW_HOURS = 24;

export type PinOffer = { minPaise: number; seconds: number };

// The creator's offer, or null when they do not offer it. Needs the switch (checked by the
// caller) and a stored minimum that is a whole number of paise at or above the site minimum.
export function pinOffer(row: { highlight_min_paise?: number | null; highlight_seconds?: number | null } | null | undefined): PinOffer | null {
  const min = row?.highlight_min_paise;
  if (typeof min !== "number" || !Number.isInteger(min) || min < MIN_TIP_PAISE) return null;
  return { minPaise: min, seconds: clampSeconds(row?.highlight_seconds) };
}

export function clampSeconds(value: unknown): number {
  const n = typeof value === "number" ? Math.round(value) : PIN_SECONDS_DEFAULT;
  if (!Number.isFinite(n)) return PIN_SECONDS_DEFAULT;
  return Math.min(PIN_SECONDS_MAX, Math.max(PIN_SECONDS_MIN, n));
}

// What the creator typed on the settings page: whole rupees (empty turns it off) and seconds.
export function parsePinSettings(
  rupees: string,
  seconds: string,
): { ok: true; minPaise: number | null; seconds: number } | { ok: false; message: string } {
  const secs = Number(seconds);
  if (!Number.isInteger(secs) || secs < PIN_SECONDS_MIN || secs > PIN_SECONDS_MAX) {
    return { ok: false, message: `Pick between ${PIN_SECONDS_MIN} and ${PIN_SECONDS_MAX} seconds.` };
  }
  const trimmed = rupees.trim();
  if (trimmed === "") return { ok: true, minPaise: null, seconds: secs };
  if (!/^\d{1,6}$/.test(trimmed)) return { ok: false, message: "Type the minimum tip in whole rupees." };
  const minPaise = Number(trimmed) * 100;
  if (minPaise < MIN_TIP_PAISE) {
    return { ok: false, message: `The minimum cannot be under ₹${MIN_TIP_PAISE / 100}, the smallest tip on the site.` };
  }
  if (minPaise > 10_000_000) return { ok: false, message: "The minimum cannot be over ₹1,00,000." };
  return { ok: true, minPaise, seconds: secs };
}

// The server's check when a fan asks to pin. Returns the words for the fan, or null if fine.
export function checkPinRequest(o: {
  featureOn: boolean;
  offer: PinOffer | null;
  amountPaise: number;
  message: string | null;
}): string | null {
  if (!o.featureOn || !o.offer) return "This creator is not offering pinned messages right now.";
  if (!o.message?.trim()) return "Write a message to pin.";
  if (o.amountPaise < o.offer.minPaise) {
    return `Tip at least ₹${Math.ceil(o.offer.minPaise / 100)} to pin your message.`;
  }
  return null;
}

export type PinnedCard = { id: number; name: string; amountPaise: number; message: string; secondsLeft: number };

// What the overlay may show for a pinned tip: the creator's banned words are checked now,
// not when the fan paid. A blocked message shows nothing at all; a blocked name shows as
// Anonymous. Never anything for a tip that is not captured, not approved or already over.
export function resolvePinned(
  row:
    | {
        id: number;
        fan_name: string | null;
        fan_message: string | null;
        gross_amount_minor: string | number;
        status: string;
        message_status: string;
        highlight_until: Date | null;
      }
    | null
    | undefined,
  bannedWords: readonly string[],
  now: Date,
): PinnedCard | null {
  if (!row || row.status !== "captured" || row.message_status !== "approved") return null;
  const message = row.fan_message?.trim();
  if (!message || !row.highlight_until) return null;
  const left = Math.ceil((row.highlight_until.getTime() - now.getTime()) / 1000);
  if (left <= 0) return null;
  if (findBlockedWord(message, bannedWords) !== null) return null;
  const nameBlocked = findBlockedWord(row.fan_name, bannedWords) !== null;
  return {
    id: row.id,
    name: (!nameBlocked && row.fan_name?.trim()) || "Anonymous",
    amountPaise: Number(row.gross_amount_minor),
    message,
    secondsLeft: left,
  };
}
