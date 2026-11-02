// Volume and layout presets for the OBS alert (paid feature `alertLayout`). Pure: no I/O, so
// the overlay, the dashboard preview, the save action and the tests share one set of rules.
//
// The creator sets a master volume for their alert sounds and for the spoken voice (each only
// quieter than the file or voice already is, 10 to 100 percent, so nothing is ever louder than
// it was recorded) and may put the picture beside the card, left or right, instead of above it.
// Nothing is free-form: keys and whole percentages. Whatever is stored is checked again at play
// time, and anything that does not pass falls back to the normal alert, so a bad value can never
// break or silence an alert.

export type MediaSide = "left" | "right";

export const SIDE_CHOICES: readonly { key: MediaSide | "above"; label: string }[] = [
  { key: "above", label: "Above the card" },
  { key: "left", label: "Left of the card" },
  { key: "right", label: "Right of the card" },
];

export const VOLUME_MIN_PERCENT = 10;
export const VOLUME_MAX_PERCENT = 100;

// What is stored (users.alert_layout) and what the alert JSON carries once resolved. A missing
// field is the normal alert for that part; 100 percent is normal, so it is never stored.
export type AlertLayout = {
  side?: MediaSide;
  soundVolume?: number;
  voiceVolume?: number;
};

const SIDE_KEYS = new Set<string>(["left", "right"]);

// What the form sends: every field as the person left it ("" or null for the normal one).
export type AlertLayoutInput = {
  side?: unknown;
  soundVolume?: unknown;
  voiceVolume?: unknown;
};

// A whole percentage inside the range. Empty is "the normal one". Returns undefined when the
// input is not valid.
function percent(raw: unknown): number | null | undefined {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : /^\d{1,3}$/.test(String(raw).trim()) ? parseInt(String(raw), 10) : NaN;
  if (!Number.isInteger(n) || n < VOLUME_MIN_PERCENT || n > VOLUME_MAX_PERCENT) return undefined;
  return n;
}

// Checks the whole form and returns the value to store (null when everything is normal), or the
// first thing wrong, in words for the creator.
export function parseAlertLayout(
  input: AlertLayoutInput,
): { ok: true; value: AlertLayout | null } | { ok: false; message: string } {
  const out: AlertLayout = {};

  if (input.side !== undefined && input.side !== null && input.side !== "" && input.side !== "above") {
    if (typeof input.side !== "string" || !SIDE_KEYS.has(input.side)) return { ok: false, message: "Pick where the picture goes from the list." };
    out.side = input.side as MediaSide;
  }
  const bad = `Volume must be a whole number from ${VOLUME_MIN_PERCENT} to ${VOLUME_MAX_PERCENT} percent.`;
  const sound = percent(input.soundVolume);
  if (sound === undefined) return { ok: false, message: bad };
  if (sound !== null && sound !== VOLUME_MAX_PERCENT) out.soundVolume = sound;
  const voice = percent(input.voiceVolume);
  if (voice === undefined) return { ok: false, message: bad };
  if (voice !== null && voice !== VOLUME_MAX_PERCENT) out.voiceVolume = voice;

  return { ok: true, value: Object.keys(out).length ? out : null };
}

// Reads a stored value (jsonb from the database, or anything) into a clean AlertLayout. Every
// field is checked on its own and dropped if it is not valid. null is the normal alert.
export function resolveAlertLayout(raw: unknown): AlertLayout | null {
  // A driver may hand jsonb back as text; read it either way.
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const out: AlertLayout = {};

  if (typeof r.side === "string" && SIDE_KEYS.has(r.side)) out.side = r.side as MediaSide;
  // Stored numbers only (the form's strings are turned into numbers before saving).
  for (const key of ["soundVolume", "voiceVolume"] as const) {
    if (typeof r[key] !== "number") continue;
    const p = percent(r[key]);
    if (p && p !== VOLUME_MAX_PERCENT) out[key] = p;
  }
  return Object.keys(out).length ? out : null;
}

// The volume a sound or voice plays at (0 to 1): its own level times the creator's master. A
// sound keeps its old floor of 10 percent of its own level; the master may go lower.
export function mixVolume(own: number, masterPercent: number | undefined): number {
  const base = Math.min(1, Math.max(0.1, own));
  const master = masterPercent === undefined ? 1 : Math.min(1, Math.max(VOLUME_MIN_PERCENT, masterPercent) / 100);
  return +(base * master).toFixed(3);
}
