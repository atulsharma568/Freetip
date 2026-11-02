// Alert text and colours for the OBS alert card (paid feature `alertText`). Pure: no I/O,
// so the overlay, the dashboard preview, the save action and the tests share one set of
// rules.
//
// The creator can change the headline line ("{name} tipped"), the card, text and amount
// colours, the text size and the weight. Nothing here is free-form markup: the headline is
// plain text with two placeholders, colours are #rrggbb, size and weight are keys from short
// lists. Whatever is stored is checked again at play time, and anything that does not pass
// (a hand-edited row, an accent change that made a colour unreadable) falls back to the
// normal card, so a bad value can never break or hide an alert.

import { contrast, inkFor, safeAccent } from "./accent";
import { safeTheme } from "./overlay-themes";

export const HEADLINE_MAX = 40;
// Text on the card needs to be readable on its fill (WCAG's large-text minimum; the card
// text is large on a stream).
export const MIN_CONTRAST = 3;

export type TextSize = "small" | "normal" | "large";
export type TextWeight = "normal" | "bold";

export const TEXT_SIZES: readonly { key: TextSize; label: string; scale: number }[] = [
  { key: "small", label: "Smaller", scale: 0.85 },
  { key: "normal", label: "Normal", scale: 1 },
  { key: "large", label: "Larger", scale: 1.2 },
];

export const TEXT_WEIGHTS: readonly { key: TextWeight; label: string }[] = [
  { key: "normal", label: "Regular" },
  { key: "bold", label: "Bold" },
];

// What is stored (users.alert_text) and what the alert JSON carries once resolved. A
// missing field is the normal card for that part.
export type AlertText = {
  headline?: string;
  bg?: string;
  text?: string;
  amount?: string;
  size?: TextSize;
  weight?: TextWeight;
};

const HEX = /^#[0-9a-f]{6}$/;
const SIZE_KEYS = new Set<string>(TEXT_SIZES.map((s) => s.key));
const WEIGHT_KEYS = new Set<string>(TEXT_WEIGHTS.map((w) => w.key));

// ── the headline ────────────────────────────────────────────────────────────

export type HeadlineSegment = { kind: "text" | "name" | "amount"; text: string };

// Splits "{name} tipped {amount}" into pieces. Only {name} and {amount} are placeholders.
export function headlineSegments(template: string): HeadlineSegment[] {
  const out: HeadlineSegment[] = [];
  for (const part of template.split(/(\{name\}|\{amount\})/)) {
    if (!part) continue;
    if (part === "{name}") out.push({ kind: "name", text: part });
    else if (part === "{amount}") out.push({ kind: "amount", text: part });
    else out.push({ kind: "text", text: part });
  }
  return out;
}

// A headline the creator typed, cleaned: control and invisible characters out, spaces
// collapsed. Returns the clean text, or why it cannot be used. An empty string means "use
// the normal headline" (null).
export function parseHeadline(raw: unknown): { ok: true; value: string | null } | { ok: false; message: string } {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, message: "The headline must be text." };
  const clean = raw
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return { ok: true, value: null };
  if (clean.length > HEADLINE_MAX) return { ok: false, message: `Keep the headline to ${HEADLINE_MAX} characters.` };
  // Braces are only for the two placeholders, each used at most once.
  const stripped = clean.replace(/\{name\}/g, "").replace(/\{amount\}/g, "");
  if (/[{}]/.test(stripped)) return { ok: false, message: "Only {name} and {amount} can go in curly brackets." };
  if ((clean.match(/\{name\}/g) ?? []).length !== 1) return { ok: false, message: "Use {name} once, so your supporter is always named." };
  if ((clean.match(/\{amount\}/g) ?? []).length > 1) return { ok: false, message: "Use {amount} at most once." };
  return { ok: true, value: clean };
}

// ── colours ─────────────────────────────────────────────────────────────────

// A colour the creator typed or picked: "#RRGGBB" in any case. Empty is "the normal one".
export function parseColour(raw: unknown): { ok: true; value: string | null } | { ok: false } {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false };
  const v = raw.trim().toLowerCase();
  return HEX.test(v) ? { ok: true, value: v } : { ok: false };
}

// The card and text colours the chosen theme gives when the creator sets none: the accent and
// its ink on Classic and Blocky, the dark card on Midnight and Neon, the light card on Paper
// (mirrors src/lib/overlay-themes.ts).
export function baseColours(theme: unknown, accent: string | null | undefined): { bg: string; fg: string } {
  const a = safeAccent(accent);
  switch (safeTheme(theme)) {
    case "midnight":
    case "neon":
      return { bg: "#0c0d09", fg: "#eeefea" };
    case "paper":
      return { bg: "#f4f3ec", fg: "#14170a" };
    default:
      return { bg: a, fg: inkFor(a) };
  }
}

// The colours the card really ends up with: the creator's, or the theme's.
export function effectiveColours(text: AlertText | null | undefined, base: { bg: string; fg: string }) {
  const bg = text?.bg ?? base.bg;
  // A card colour with no text colour gets the ink that reads best on it.
  const fg = text?.text ?? (text?.bg ? inkFor(text.bg) : base.fg);
  const amount = text?.amount ?? fg;
  return { bg, fg, amount };
}

// Why these colours cannot be used together, or null when they can. The same check runs
// when the creator saves and again when an alert is shown.
export function colourProblem(text: AlertText | null | undefined, base: { bg: string; fg: string }): string | null {
  const { bg, fg, amount } = effectiveColours(text, base);
  if (contrast(bg, fg) < MIN_CONTRAST) return "The text colour is too close to the card colour to read on stream. Pick colours that differ more.";
  if (contrast(bg, amount) < MIN_CONTRAST) return "The amount colour is too close to the card colour to read on stream. Pick colours that differ more.";
  return null;
}

// ── storage ─────────────────────────────────────────────────────────────────

// What the form sends: every field as the person left it ("" or null for the normal one).
export type AlertTextInput = {
  headline?: unknown;
  bg?: unknown;
  text?: unknown;
  amount?: unknown;
  size?: unknown;
  weight?: unknown;
};

// Checks the whole form and returns the value to store (null when everything is the
// normal card), or the first thing wrong, in words for the creator.
export function parseAlertText(
  input: AlertTextInput,
  base: { bg: string; fg: string },
): { ok: true; value: AlertText | null } | { ok: false; message: string } {
  const headline = parseHeadline(input.headline);
  if (!headline.ok) return headline;

  const out: AlertText = {};
  if (headline.value) out.headline = headline.value;

  for (const [field, label] of [["bg", "card"], ["text", "text"], ["amount", "amount"]] as const) {
    const c = parseColour(input[field]);
    if (!c.ok) return { ok: false, message: `The ${label} colour is not a valid colour.` };
    if (c.value) out[field] = c.value;
  }

  if (input.size !== undefined && input.size !== null && input.size !== "") {
    if (typeof input.size !== "string" || !SIZE_KEYS.has(input.size)) return { ok: false, message: "Pick a text size from the list." };
    if (input.size !== "normal") out.size = input.size as TextSize;
  }
  if (input.weight !== undefined && input.weight !== null && input.weight !== "") {
    if (typeof input.weight !== "string" || !WEIGHT_KEYS.has(input.weight)) return { ok: false, message: "Pick a text weight from the list." };
    if (input.weight !== "normal") out.weight = input.weight as TextWeight;
  }

  const problem = colourProblem(out, base);
  if (problem) return { ok: false, message: problem };
  return { ok: true, value: Object.keys(out).length ? out : null };
}

// Reads a stored value (jsonb from the database, or anything) into a clean AlertText. Every
// field is checked on its own and dropped if it is not valid; if the colours no longer read
// well on the creator's current accent, they are dropped too. null is the normal card.
export function resolveAlertText(raw: unknown, base: { bg: string; fg: string }): AlertText | null {
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
  const out: AlertText = {};

  const headline = parseHeadline(r.headline);
  if (headline.ok && headline.value) out.headline = headline.value;
  for (const field of ["bg", "text", "amount"] as const) {
    const c = parseColour(r[field]);
    if (c.ok && c.value) out[field] = c.value;
  }
  if (typeof r.size === "string" && SIZE_KEYS.has(r.size) && r.size !== "normal") out.size = r.size as TextSize;
  if (typeof r.weight === "string" && WEIGHT_KEYS.has(r.weight) && r.weight !== "normal") out.weight = r.weight as TextWeight;

  if (colourProblem(out, base)) {
    delete out.bg;
    delete out.text;
    delete out.amount;
  }
  return Object.keys(out).length ? out : null;
}

// ── the card ────────────────────────────────────────────────────────────────

// The CSS variables for the card, on top of the theme's. `baseScale` is the text size the
// theme's font already asked for, so a wide font and a larger size multiply.
export function alertTextVars(text: AlertText | null | undefined, baseScale = 1): Record<string, string> {
  const out: Record<string, string> = {};
  if (!text) return out;
  if (text.bg) out["--c-bg"] = text.bg;
  const fg = text.text ?? (text.bg ? inkFor(text.bg) : null);
  if (fg) {
    out["--c-fg"] = fg;
    // The lit word and the small tags are the text colour on the card colour, so they stay readable.
    out["--c-word-bg"] = fg;
    out["--c-word-fg"] = "var(--c-bg)";
    out["--c-tag-bg"] = fg;
    out["--c-tag-fg"] = "var(--c-bg)";
  }
  if (text.amount) out["--c-amount"] = text.amount;
  const scale = TEXT_SIZES.find((s) => s.key === (text.size ?? "normal"))!.scale;
  if (scale !== 1) out["--c-fs"] = String(+(baseScale * scale).toFixed(3));
  if (text.weight === "bold") {
    out["--c-fw-top"] = "700";
    out["--c-fw-verb"] = "600";
    out["--c-fw-msg"] = "700";
  }
  return out;
}
