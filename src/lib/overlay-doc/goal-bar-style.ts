import { GROUND, MIN_GROUND_CONTRAST, contrast } from "../accent";

// The goal bar's own look (page builder phase 5, part two; users.goal_bar_style, migration 0053).
// Pure: no I/O, so the overlay, the owner's editor, the save and the tests share one set of rules.
//
// The bar colour, whether the bar shows rupees or only a percent, and whether reaching the goal
// gets its moment. Nothing is free-form: a #rrggbb colour that can be seen on the dark panel,
// and two keys. A missing field is today's bar for that part, and anything stored that does not
// pass is dropped on its own when it is read, so a bad value can never break the bar.

export type GoalBarShow = "amounts" | "percent";

// What is stored and what the goal API carries once resolved. Sparse: a missing field is today's bar.
export type GoalBarStyle = {
  // The bar colour; missing is the creator's accent.
  fill?: string;
  // Rupees and percent (missing) or the percent only; no rupee figure then leaves the server.
  show?: "percent";
  // false switches off the goal-reached moment (the card flipping to the accent); missing is on.
  celebrate?: false;
};

// What the editor's form holds and sends: every field as the person left it.
export type GoalBarInput = { fill?: unknown; show?: unknown; celebrate?: unknown };

const HEX = /^#[0-9a-f]{6}$/;

function fillProblem(raw: unknown): { ok: true; value: string | null } | { ok: false; message: string } {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, message: "Colours are written as #rrggbb." };
  const value = raw.trim().toLowerCase();
  if (!HEX.test(value)) return { ok: false, message: "Colours are written as #rrggbb." };
  const ratio = contrast(value, GROUND);
  if (ratio < MIN_GROUND_CONTRAST) {
    return { ok: false, message: `The bar colour on the goal bar is ${ratio.toFixed(1)} to 1; it needs ${MIN_GROUND_CONTRAST} to be seen on stream.` };
  }
  return { ok: true, value };
}

// Checks the whole form and returns the value to store (null when everything is today's bar), or
// the first thing wrong, in words for the owner.
export function parseGoalBarStyle(input: GoalBarInput): { ok: true; value: GoalBarStyle | null } | { ok: false; message: string } {
  const out: GoalBarStyle = {};
  const fill = fillProblem(input.fill);
  if (!fill.ok) return fill;
  if (fill.value) out.fill = fill.value;
  if (input.show !== undefined && input.show !== null && input.show !== "") {
    if (input.show !== "amounts" && input.show !== "percent") return { ok: false, message: "Pick rupees and percent, or percent only." };
    if (input.show === "percent") out.show = "percent";
  }
  if (input.celebrate !== undefined && input.celebrate !== null) {
    if (typeof input.celebrate !== "boolean") return { ok: false, message: "The goal-reached moment is on or off." };
    if (!input.celebrate) out.celebrate = false;
  }
  return { ok: true, value: Object.keys(out).length ? out : null };
}

// Reads a stored value (jsonb from the database, or anything) into a clean GoalBarStyle. Every
// field is checked on its own and dropped if it is not valid. null is today's bar.
export function resolveGoalBarStyle(raw: unknown): GoalBarStyle | null {
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
  const out: GoalBarStyle = {};
  const fill = fillProblem(r.fill);
  if (fill.ok && fill.value) out.fill = fill.value;
  if (r.show === "percent") out.show = "percent";
  if (r.celebrate === false) out.celebrate = false;
  return Object.keys(out).length ? out : null;
}

// The form's view of a stored style.
export function goalBarInput(style: GoalBarStyle | null): { fill: string; show: GoalBarShow; celebrate: boolean } {
  return { fill: style?.fill ?? "", show: style?.show ?? "amounts", celebrate: style?.celebrate !== false };
}
