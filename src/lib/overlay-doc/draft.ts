import { safeAccent } from "../accent";
import { baseColours, parseAlertText, resolveAlertText, type AlertText } from "../alert-text";
import { parseAlertMotion, resolveAlertMotion, type AlertMotion } from "../alert-motion";
import { parseAlertLayout, resolveAlertLayout, type AlertLayout } from "../alert-layout";
import { safeFont, safeTheme, DEFAULT_FONT, DEFAULT_THEME, type FontKey, type ThemeKey } from "../overlay-themes";
import { hasFeature } from "../plans";
import { goalBarInput, parseGoalBarStyle, resolveGoalBarStyle, type GoalBarShow, type GoalBarStyle } from "./goal-bar-style";

// The owner's unpublished edits to a creator's OBS overlays (page builder phase 5, part two;
// users.overlay_draft, migration 0053). Pure: no I/O, no site imports beyond the rules the
// creator's own dashboard pages already use, so the editor, Publish and the tests share them.
//
// There is no second way to describe an alert. The draft holds the same fields the creator's
// pages have, each part as a form would send it (text as typed), and Publish runs every part
// through the same parser the creator's save uses (`parseAlertText`, `parseAlertMotion`,
// `parseAlertLayout`, theme and font keys, `parseGoalBarStyle`) before it writes the live columns
// the alert already reads. A draft is always a whole snapshot, every part present.

export const OVERLAY_DRAFT_VERSION = 1 as const;

// Longest text any field of the draft may hold (the headline is the longest real field).
const FIELD_MAX = 200;
// The biggest draft the store accepts, as JSON.
export const OVERLAY_DRAFT_MAX_JSON = 4000;

export type OverlayDraft = {
  version: typeof OVERLAY_DRAFT_VERSION;
  text: { headline: string; bg: string; text: string; amount: string; size: string; weight: string };
  motion: { enter: string; exit: string; seconds: string; gap: string };
  layout: { side: string; soundVolume: string; voiceVolume: string };
  style: { theme: ThemeKey; font: FontKey };
  goalBar: { fill: string; show: GoalBarShow; celebrate: boolean };
};

// Which parts of the draft a creator's paid switches let the owner change. A part whose switch is
// off is never written live (the overlay would ignore it anyway): the editor shows it disabled.
export type OverlayParts = { text: boolean; motion: boolean; layout: boolean; style: boolean; goalBar: boolean };

export function overlayParts(row: { paid_features: string[] | null }): OverlayParts {
  return {
    text: hasFeature(row, "alertText"),
    motion: hasFeature(row, "alertMotion"),
    layout: hasFeature(row, "alertLayout"),
    style: hasFeature(row, "overlayThemes"),
    // The goal bar's look is part of the custom page, so it follows that switch.
    goalBar: hasFeature(row, "pageBuilder"),
  };
}

// The live values behind a creator's overlays, as the database holds them (any of them may be null
// or, before a migration, missing).
export type LiveOverlay = {
  alertText: unknown;
  alertMotion: unknown;
  alertLayout: unknown;
  theme: unknown;
  font: unknown;
  goalBar: unknown;
};

const str = (v: unknown) => (typeof v === "string" ? v.slice(0, FIELD_MAX) : typeof v === "number" && Number.isFinite(v) ? String(v) : "");

// The draft that says "leave everything as it is now": the live values written out as form fields.
// The card colours only count against the theme that is live (the same rule the alert uses).
export function draftFromLive(live: LiveOverlay, accent: string | null | undefined, parts: OverlayParts): OverlayDraft {
  const theme = safeTheme(live.theme);
  const font = safeFont(live.font);
  const text: AlertText | null = resolveAlertText(live.alertText, baseColours(parts.style ? theme : null, accent));
  const motion: AlertMotion | null = resolveAlertMotion(live.alertMotion);
  const layout: AlertLayout | null = resolveAlertLayout(live.alertLayout);
  return {
    version: OVERLAY_DRAFT_VERSION,
    text: {
      headline: text?.headline ?? "",
      bg: text?.bg ?? "",
      text: text?.text ?? "",
      amount: text?.amount ?? "",
      size: text?.size ?? "normal",
      weight: text?.weight ?? "normal",
    },
    motion: { enter: motion?.enter ?? "wipe", exit: motion?.exit ?? "wipe", seconds: motion?.seconds ? String(motion.seconds) : "", gap: motion?.gap ? String(motion.gap) : "" },
    layout: { side: layout?.side ?? "above", soundVolume: layout?.soundVolume ? String(layout.soundVolume) : "", voiceVolume: layout?.voiceVolume ? String(layout.voiceVolume) : "" },
    style: { theme, font },
    goalBar: goalBarInput(resolveGoalBarStyle(live.goalBar)),
  };
}

function asObject(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
}

// Reads a stored or sent draft into a clean one. Lenient on purpose: it only shapes the values
// (known keys, text no longer than a field, theme and font keys from the lists), because whether
// they are acceptable is Publish's decision, made by the real parsers. Anything that is not an
// object gives null, so a bad stored value is treated as "no draft".
export function parseOverlayDraft(raw: unknown): OverlayDraft | null {
  const r = asObject(raw);
  if (!r) return null;
  const part = (key: string) => asObject(r[key]) ?? {};
  const t = part("text");
  const m = part("motion");
  const l = part("layout");
  const s = part("style");
  const g = part("goalBar");
  return {
    version: OVERLAY_DRAFT_VERSION,
    text: { headline: str(t.headline), bg: str(t.bg), text: str(t.text), amount: str(t.amount), size: str(t.size) || "normal", weight: str(t.weight) || "normal" },
    motion: { enter: str(m.enter) || "wipe", exit: str(m.exit) || "wipe", seconds: str(m.seconds), gap: str(m.gap) },
    layout: { side: str(l.side) || "above", soundVolume: str(l.soundVolume), voiceVolume: str(l.voiceVolume) },
    style: { theme: s.theme === undefined ? DEFAULT_THEME : safeTheme(s.theme), font: s.font === undefined ? DEFAULT_FONT : safeFont(s.font) },
    goalBar: { fill: str(g.fill), show: g.show === "percent" ? "percent" : "amounts", celebrate: g.celebrate !== false },
  };
}

// What Publish writes: each part as the live column holds it. A part that is not allowed (its
// switch is off) is left out and named in `skipped`.
export type OverlayValues = {
  alertText?: AlertText | null;
  alertMotion?: AlertMotion | null;
  alertLayout?: AlertLayout | null;
  style?: { theme: ThemeKey; font: FontKey };
  goalBar?: GoalBarStyle | null;
};

export type CheckedDraft = { ok: true; values: OverlayValues; skipped: string[] } | { ok: false; message: string };

// Checks the whole draft with the same rules the creator's own pages use, in the same order, and
// returns what to store, or the first thing wrong in words for the owner. Nothing is stored here.
export function checkDraft(draft: OverlayDraft, row: { paid_features: string[] | null; accent: string | null }): CheckedDraft {
  const parts = overlayParts(row);
  const values: OverlayValues = {};
  const skipped: string[] = [];
  const accent = safeAccent(row.accent);

  // The card style comes first: the card colours are checked against the card the theme gives.
  if (parts.style) values.style = { theme: safeTheme(draft.style.theme), font: safeFont(draft.style.font) };
  else skipped.push("card style and font");

  if (parts.text) {
    const theme = parts.style ? values.style!.theme : null;
    const parsed = parseAlertText(draft.text, baseColours(theme, accent));
    if (!parsed.ok) return { ok: false, message: parsed.message };
    values.alertText = parsed.value;
  } else skipped.push("alert text and colours");

  if (parts.motion) {
    const parsed = parseAlertMotion(draft.motion);
    if (!parsed.ok) return { ok: false, message: parsed.message };
    values.alertMotion = parsed.value;
  } else skipped.push("animations and timing");

  if (parts.layout) {
    const parsed = parseAlertLayout(draft.layout);
    if (!parsed.ok) return { ok: false, message: parsed.message };
    values.alertLayout = parsed.value;
  } else skipped.push("volume and layout");

  if (parts.goalBar) {
    const parsed = parseGoalBarStyle(draft.goalBar);
    if (!parsed.ok) return { ok: false, message: parsed.message };
    values.goalBar = parsed.value;
  } else skipped.push("goal bar look");

  return { ok: true, values, skipped };
}

// The live values a Publish would leave behind, as the same shape (resolved, so the comparison is
// between what an overlay would really draw), used to refuse a Publish that changes nothing.
export function liveAsValues(live: LiveOverlay, row: { paid_features: string[] | null; accent: string | null }): OverlayValues {
  const parts = overlayParts(row);
  const accent = safeAccent(row.accent);
  const theme = safeTheme(live.theme);
  const out: OverlayValues = {};
  if (parts.style) out.style = { theme, font: safeFont(live.font) };
  if (parts.text) out.alertText = resolveAlertText(live.alertText, baseColours(parts.style ? theme : null, accent));
  if (parts.motion) out.alertMotion = resolveAlertMotion(live.alertMotion);
  if (parts.layout) out.alertLayout = resolveAlertLayout(live.alertLayout);
  if (parts.goalBar) out.goalBar = resolveGoalBarStyle(live.goalBar);
  return out;
}

export const sameValues = (a: OverlayValues, b: OverlayValues) => JSON.stringify(a) === JSON.stringify(b);
