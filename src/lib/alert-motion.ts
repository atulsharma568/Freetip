// Alert animations and timing for the OBS alert card (paid feature `alertMotion`). Pure: no
// I/O, so the overlay, the dashboard preview, the save action and the tests share one set of
// rules.
//
// The creator picks how the card comes in and leaves from short lists of keys, how long it
// stays and a pause between alerts. Nothing is free-form: keys, whole seconds in a range.
// Whatever is stored is checked again at play time, and anything that does not pass falls
// back to the normal card (the wipe, the usual length, the usual pause), so a bad value can
// never break or hide an alert. The card never leaves before the voice, sound or video has
// finished, whatever length is chosen (see showMs in AlertStage.tsx).

export type EnterKey = "wipe" | "fade" | "slide" | "zoom" | "bounce";
export type ExitKey = "wipe" | "fade" | "slide" | "zoom";

export const ENTER_CHOICES: readonly { key: EnterKey; label: string }[] = [
  { key: "wipe", label: "Wipe" },
  { key: "fade", label: "Fade" },
  { key: "slide", label: "Slide up" },
  { key: "zoom", label: "Zoom" },
  { key: "bounce", label: "Bounce" },
];

export const EXIT_CHOICES: readonly { key: ExitKey; label: string }[] = [
  { key: "wipe", label: "Wipe" },
  { key: "fade", label: "Fade" },
  { key: "slide", label: "Slide down" },
  { key: "zoom", label: "Zoom out" },
];

// How long the card stays, in whole seconds. The normal length is 6 seconds plus reading
// time for the message, so 5 is a little shorter than the shortest normal alert.
export const LENGTH_MIN_SECONDS = 5;
export const LENGTH_MAX_SECONDS = 30;
// A pause after the card leaves, before the next alert shows. 0 is the normal short beat.
export const GAP_MAX_SECONDS = 10;

// What is stored (users.alert_motion) and what the alert JSON carries once resolved. A
// missing field is the normal card for that part.
export type AlertMotion = {
  enter?: EnterKey;
  exit?: ExitKey;
  seconds?: number;
  gap?: number;
};

const ENTER_KEYS = new Set<string>(ENTER_CHOICES.map((c) => c.key));
const EXIT_KEYS = new Set<string>(EXIT_CHOICES.map((c) => c.key));

// The normal card: wipe in, wipe out.
const NORMAL_ENTER: EnterKey = "wipe";
const NORMAL_EXIT: ExitKey = "wipe";

// What the form sends: every field as the person left it ("" or null for the normal one).
export type AlertMotionInput = {
  enter?: unknown;
  exit?: unknown;
  seconds?: unknown;
  gap?: unknown;
};

// A whole number of seconds inside a range. Empty is "the normal one". Returns undefined when
// the input is not valid.
function wholeSeconds(raw: unknown, min: number, max: number): number | null | undefined {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : /^\d{1,3}$/.test(String(raw).trim()) ? parseInt(String(raw), 10) : NaN;
  if (!Number.isInteger(n) || n < min || n > max) return undefined;
  return n;
}

// Checks the whole form and returns the value to store (null when everything is the normal
// card), or the first thing wrong, in words for the creator.
export function parseAlertMotion(
  input: AlertMotionInput,
): { ok: true; value: AlertMotion | null } | { ok: false; message: string } {
  const out: AlertMotion = {};

  if (input.enter !== undefined && input.enter !== null && input.enter !== "") {
    if (typeof input.enter !== "string" || !ENTER_KEYS.has(input.enter)) return { ok: false, message: "Pick how the card comes in from the list." };
    if (input.enter !== NORMAL_ENTER) out.enter = input.enter as EnterKey;
  }
  if (input.exit !== undefined && input.exit !== null && input.exit !== "") {
    if (typeof input.exit !== "string" || !EXIT_KEYS.has(input.exit)) return { ok: false, message: "Pick how the card leaves from the list." };
    if (input.exit !== NORMAL_EXIT) out.exit = input.exit as ExitKey;
  }

  const seconds = wholeSeconds(input.seconds, LENGTH_MIN_SECONDS, LENGTH_MAX_SECONDS);
  if (seconds === undefined) return { ok: false, message: `The length must be a whole number from ${LENGTH_MIN_SECONDS} to ${LENGTH_MAX_SECONDS} seconds.` };
  if (seconds !== null) out.seconds = seconds;

  const gap = wholeSeconds(input.gap, 0, GAP_MAX_SECONDS);
  if (gap === undefined) return { ok: false, message: `The pause must be a whole number from 0 to ${GAP_MAX_SECONDS} seconds.` };
  if (gap) out.gap = gap;

  return { ok: true, value: Object.keys(out).length ? out : null };
}

// Reads a stored value (jsonb from the database, or anything) into a clean AlertMotion. Every
// field is checked on its own and dropped if it is not valid. null is the normal card.
export function resolveAlertMotion(raw: unknown): AlertMotion | null {
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
  const out: AlertMotion = {};

  if (typeof r.enter === "string" && ENTER_KEYS.has(r.enter) && r.enter !== NORMAL_ENTER) out.enter = r.enter as EnterKey;
  if (typeof r.exit === "string" && EXIT_KEYS.has(r.exit) && r.exit !== NORMAL_EXIT) out.exit = r.exit as ExitKey;
  // Stored numbers only (the form's strings are turned into numbers before saving).
  if (typeof r.seconds === "number") {
    const s = wholeSeconds(r.seconds, LENGTH_MIN_SECONDS, LENGTH_MAX_SECONDS);
    if (s) out.seconds = s;
  }
  if (typeof r.gap === "number") {
    const g = wholeSeconds(r.gap, 0, GAP_MAX_SECONDS);
    if (g) out.gap = g;
  }
  return Object.keys(out).length ? out : null;
}

// How long the card stays when the creator set a length (milliseconds), else null. The
// overlay still holds it for as long as the voice, sound or video needs.
export function motionStayMs(motion: AlertMotion | null | undefined): number | null {
  return motion?.seconds ? motion.seconds * 1000 : null;
}

// The pause after the card leaves, in milliseconds (0 is the normal short beat).
export function motionGapMs(motion: AlertMotion | null | undefined): number {
  return motion?.gap ? motion.gap * 1000 : 0;
}
