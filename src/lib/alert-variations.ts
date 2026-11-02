// Automatic variations by tip size (paid feature `alertVariations`). Pure: no I/O, so the
// overlay resolver, the save action, the dashboard preview and the tests share one set of
// rules.
//
// A variation is "from this tip size up, play this media, this sound, this wording and these
// colours, and stay this long", applied to a plain tip without the fan picking anything. The
// highest size at or below the tip wins. It never competes with a fan's own choice:
//   - a tip that picked an alert rule on the tip page gets no variation at all;
//   - a sound the fan picked on the soundboard beats the variation's sound;
//   - a voice tip has no sound, so the variation's sound is dropped.
// Each part is also governed by its own switch at play time: the media by `customAlertMedia`,
// the wording and colours by `alertText`, the long stay by the same big-tip floor as rules.

import { STAY_MAX_SECONDS, STAY_MIN_RUPEES, STAY_MIN_SECONDS, RULE_MAX_RUPEES, parseStaySeconds } from "./alert-rules";
import {
  colourProblem,
  effectiveColours,
  parseAlertText,
  resolveAlertText,
  type AlertText,
  type AlertTextInput,
} from "./alert-text";

export const MAX_VARIATIONS_PER_CREATOR = 10;
// A variation from ₹0 would be every tip, which the creator's normal settings already are.
export const VARIATION_MIN_RUPEES = 1;

type Colours = { bg: string; fg: string };

// One variation as the overlay needs it. `sound` is already looked up (null when it has none,
// or the sound was deleted); `text` is what is stored, checked again at play time.
export type AlertVariation = {
  id: number;
  minPaise: number;
  mediaId: number | null;
  sound: { url: string; volume: number; ms: number } | null;
  text: unknown;
  stayMs: number | null;
};

// The variation a tip gets: the one with the highest size at or below the tip.
export function pickVariation(list: readonly AlertVariation[], amountPaise: number): AlertVariation | null {
  let best: AlertVariation | null = null;
  for (const v of list) {
    if (v.minPaise <= amountPaise && (!best || v.minPaise > best.minPaise)) best = v;
  }
  return best;
}

// A long stay only counts from the big-tip size up and within the cap (the database holds the
// same rule; this is the play-time check).
export function variationStayMs(v: Pick<AlertVariation, "minPaise" | "stayMs">): number | null {
  if (!v.stayMs || v.minPaise < STAY_MIN_RUPEES * 100) return null;
  const s = Math.round(v.stayMs / 1000);
  return s >= STAY_MIN_SECONDS && s <= STAY_MAX_SECONDS ? s * 1000 : null;
}

// The card a variation's colours will sit on: the creator's own colours if they set some, else
// the theme's. A variation's colours are judged against this, not the plain card, so a
// creator with a dark card can give a big tip a bright amount.
function cardUnder(standard: AlertText | null, base: Colours): Colours {
  const { bg, fg } = effectiveColours(standard, base);
  return { bg, fg };
}

// The creator's standard text with the variation's on top, field by field. If the variation's
// colours would not read on the creator's own card colour (or the other way round), only its
// wording, size and weight are used and the standard colours stay.
export function mergeAlertText(
  standard: AlertText | null,
  variation: AlertText | null,
  base: Colours,
): AlertText | null {
  if (!variation) return standard;
  let merged: AlertText = { ...standard, ...variation };
  if (colourProblem(merged, base)) {
    const { bg: _bg, text: _text, amount: _amount, ...wording } = variation; // eslint-disable-line @typescript-eslint/no-unused-vars
    merged = { ...standard, ...wording };
  }
  return Object.keys(merged).length ? merged : null;
}

// The text a stored variation gives at play time: its own fields, checked, on top of the
// standard text.
export function variationText(
  stored: unknown,
  standard: AlertText | null,
  base: Colours,
): AlertText | null {
  return mergeAlertText(standard, resolveAlertText(stored, cardUnder(standard, base)), base);
}

// What the form sends.
export type VariationInput = {
  minRupees: unknown;
  mediaId?: unknown;
  soundId?: unknown;
  staySeconds?: unknown;
  text?: AlertTextInput | null;
};

export type ParsedVariation = {
  minPaise: number;
  mediaId: number | null;
  soundId: number | null;
  staySeconds: number | null;
  text: AlertText | null;
};

function asId(v: unknown): number | null | undefined {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}

// Checks the whole form and returns what to store, or the first thing wrong in words for the
// creator. `standard` is the creator's own alert text (null if none or the feature is off), so
// colours are judged on the card they will really sit on.
export function parseVariation(
  input: VariationInput,
  ctx: { base: Colours; standard: AlertText | null; textOn: boolean },
): { ok: true; value: ParsedVariation } | { ok: false; message: string } {
  const rupeesRaw = typeof input.minRupees === "number" ? input.minRupees : parseInt(String(input.minRupees ?? ""), 10);
  if (!Number.isInteger(rupeesRaw) || rupeesRaw < VARIATION_MIN_RUPEES || rupeesRaw > RULE_MAX_RUPEES) {
    return { ok: false, message: `Enter the tip size in whole rupees, from ₹${VARIATION_MIN_RUPEES}.` };
  }
  const mediaId = asId(input.mediaId);
  const soundId = asId(input.soundId);
  if (mediaId === undefined || soundId === undefined) return { ok: false, message: "Pick a file or sound from the lists." };

  const stay = parseStaySeconds(input.staySeconds, rupeesRaw);
  if (stay === undefined) {
    return {
      ok: false,
      message: `The alert can stay for 10 seconds to 5 minutes, and only for tips of ₹${STAY_MIN_RUPEES.toLocaleString("en-IN")} or more.`,
    };
  }

  let text: AlertText | null = null;
  if (input.text) {
    if (!ctx.textOn) return { ok: false, message: "Alert text and colours are not switched on for your account." };
    const parsed = parseAlertText(input.text, cardUnder(ctx.standard, ctx.base));
    if (!parsed.ok) return parsed;
    text = parsed.value;
    if (text && colourProblem({ ...ctx.standard, ...text }, ctx.base)) {
      return {
        ok: false,
        message: "These colours do not read well together with your standard alert colours. Pick colours that differ more.",
      };
    }
  }

  if (mediaId === null && soundId === null && stay === null && text === null) {
    return { ok: false, message: "Pick a media file, a sound, new text or colours, or a longer stay." };
  }
  return { ok: true, value: { minPaise: rupeesRaw * 100, mediaId, soundId, staySeconds: stay, text } };
}
