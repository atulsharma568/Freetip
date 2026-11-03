import { inkFor, pairChecks } from "../accent";
import { BLOCK_LABELS, LIMITS, PROTECTED, defaultSettings } from "./blocks";
import { findChoiceField, findTextField } from "./fields";
import type { Block, BlockType, Ladder, PageDoc } from "./types";

// The editor's changes to a document, as pure functions. Each one returns a new document and a
// list of plain-English problems; it never changes the one it is given and never throws. A change
// that would make the document wrong (a protected block hidden, a word too long, colours nobody
// can read, a ladder out of order) is refused: `doc` comes back unchanged with the reason in
// `problems`, so the editor can show it and the preview never sees a document the parser would
// change. `changed` says whether anything is different.

export interface EditResult {
  doc: PageDoc;
  problems: string[];
  changed: boolean;
}

const refuse = (doc: PageDoc, ...problems: string[]): EditResult => ({ doc, problems, changed: false });
const done = (doc: PageDoc): EditResult => ({ doc, problems: [], changed: true });

const CONTROL = /[\u0000-\u001f\u007f]/;
const HEX = /^#[0-9a-f]{6}$/i;

function indexOf(doc: PageDoc, type: BlockType): number {
  return doc.blocks.findIndex((b) => b.type === type);
}

// Moves a block one place up or down inside its own section, stepping over hidden neighbours too
// (the editor lists them). At either end, or for a block the page does not have, nothing changes.
export function moveBlock(doc: PageDoc, type: BlockType, direction: "up" | "down"): EditResult {
  const at = indexOf(doc, type);
  if (at < 0) return refuse(doc, "That block is not on the page.");
  const slot = doc.blocks[at].slot;
  const inSection = doc.blocks.map((b, i) => ({ b, i })).filter(({ b }) => b.slot === slot);
  const position = inSection.findIndex(({ i }) => i === at);
  const neighbour = inSection[position + (direction === "up" ? -1 : 1)];
  if (!neighbour) return refuse(doc);
  const blocks = doc.blocks.slice();
  [blocks[at], blocks[neighbour.i]] = [blocks[neighbour.i], blocks[at]];
  return done({ ...doc, blocks });
}

export function setVisible(doc: PageDoc, type: BlockType, visible: boolean): EditResult {
  const at = indexOf(doc, type);
  if (at < 0) return refuse(doc, "That block is not on the page.");
  if (!visible && PROTECTED.includes(type)) return refuse(doc, `The ${BLOCK_LABELS[type]} block has to stay on the page.`);
  if (doc.blocks[at].visible === visible) return refuse(doc);
  const blocks = doc.blocks.slice();
  blocks[at] = { ...blocks[at], visible } as Block;
  return done({ ...doc, blocks });
}

function withSettings(doc: PageDoc, at: number, patch: Record<string, unknown>): PageDoc {
  const blocks = doc.blocks.slice();
  blocks[at] = { ...blocks[at], settings: { ...blocks[at].settings, ...patch } } as Block;
  return { ...doc, blocks };
}

// Sets one word. The text is kept as typed (spaces and all, so typing is not fought); the parser
// trims it when the draft is saved. Too long, a control character, or characters a field does not
// allow are refused.
export function setText(doc: PageDoc, type: BlockType, key: string, value: string): EditResult {
  const at = indexOf(doc, type);
  const field = findTextField(type, key);
  if (at < 0 || !field) return refuse(doc, "That setting does not exist.");
  if (Array.from(value).length > field.max) return refuse(doc, `${field.label} can be at most ${field.max} letters.`);
  if (CONTROL.test(value)) return refuse(doc, `${field.label} cannot hold line breaks or control characters.`);
  if (field.pattern && value !== "" && !field.pattern.test(value)) return refuse(doc, `${field.label} can hold only letters, digits, dots and underscores.`);
  if ((doc.blocks[at].settings as Record<string, unknown>)[key] === value) return refuse(doc);
  return done(withSettings(doc, at, { [key]: value }));
}

export function setChoice(doc: PageDoc, type: BlockType, key: string, value: string): EditResult {
  const at = indexOf(doc, type);
  const field = findChoiceField(type, key);
  if (at < 0 || !field) return refuse(doc, "That setting does not exist.");
  if (!field.options.some((o) => o.value === value)) return refuse(doc, `${field.label}: that choice does not exist.`);
  if ((doc.blocks[at].settings as Record<string, unknown>)[key] === value) return refuse(doc);
  return done(withSettings(doc, at, { [key]: value }));
}

// Everything wrong with a ladder, in plain English. Empty means the parser will keep it as it is.
export function validateLadder(ladder: Ladder): string[] {
  const problems: string[] = [];
  const { topRupees, levels } = ladder;
  if (!Number.isFinite(topRupees) || topRupees < LIMITS.topRupees.min || topRupees > LIMITS.topRupees.max) {
    problems.push(`The top of the bar must be between ₹${LIMITS.topRupees.min} and ₹${LIMITS.topRupees.max.toLocaleString("en-IN")}.`);
  }
  if (levels.length < LIMITS.levels.min || levels.length > LIMITS.levels.max) {
    problems.push(`Use ${LIMITS.levels.min} to ${LIMITS.levels.max} rank words.`);
  }
  let previous = 0;
  levels.forEach((level, i) => {
    const n = i + 1;
    if (!level.name.trim()) problems.push(`Rank ${n} needs a word.`);
    if (Array.from(level.name.trim()).length > LIMITS.levelName) problems.push(`Rank ${n} can be at most ${LIMITS.levelName} letters.`);
    if (CONTROL.test(level.name)) problems.push(`Rank ${n} cannot hold line breaks.`);
    if (!Number.isFinite(level.upTo) || level.upTo <= previous || level.upTo > 1) problems.push(`Rank ${n} must end higher than the one before, and at most 100%.`);
    else previous = level.upTo;
  });
  if (levels.length > 0 && levels[levels.length - 1].upTo !== 1) problems.push("The last rank must end at 100%.");
  return problems;
}

// Puts a ladder on the amount block, or takes the bar away with null.
export function setLadder(doc: PageDoc, ladder: Ladder | null): EditResult {
  const at = indexOf(doc, "amount");
  if (at < 0) return refuse(doc, "That block is not on the page.");
  if (ladder) {
    const problems = validateLadder(ladder);
    if (problems.length > 0) return refuse(doc, ...problems);
  }
  return done(withSettings(doc, at, { ladder: ladder ? structuredClone(ladder) : null }));
}

export interface ThemeResult extends EditResult {
  // The two ratios of the pair that was tried, for the editor to show beside the pickers.
  checks: { inkOnAccent: number; accentOnGround: number } | null;
}

// Sets the page colours. A null accent goes back to the creator's own accent. A null ink lets the
// page choose the ink. A pair that fails the colour rule is refused, with both ratios.
export function setTheme(doc: PageDoc, accent: string | null, ink: string | null): ThemeResult {
  if (accent === null) {
    if (doc.theme.accent === undefined && doc.theme.ink === undefined) return { ...refuse(doc), checks: null };
    return { ...done({ ...doc, theme: {} }), checks: null };
  }
  const a = accent.trim().toLowerCase();
  const i = ink === null ? null : ink.trim().toLowerCase();
  if (!HEX.test(a) || (i !== null && !HEX.test(i))) return { ...refuse(doc, "Colours are written as #rrggbb."), checks: null };
  const checks = pairChecks(a, i ?? inkFor(a));
  const shown = { inkOnAccent: checks.inkOnAccent, accentOnGround: checks.accentOnGround };
  if (!checks.ok) {
    const problems: string[] = [];
    if (checks.inkOnAccent < 4.5) problems.push(`The text on this colour is ${checks.inkOnAccent.toFixed(1)} to 1; it needs 4.5.`);
    if (checks.accentOnGround < 3) problems.push(`This colour on the page is ${checks.accentOnGround.toFixed(1)} to 1; it needs 3.`);
    return { ...refuse(doc, ...problems), checks: shown };
  }
  const theme = i === null ? { accent: a } : { accent: a, ink: i };
  if (doc.theme.accent === theme.accent && doc.theme.ink === ("ink" in theme ? theme.ink : undefined)) return { ...refuse(doc), checks: shown };
  return { ...done({ ...doc, theme }), checks: shown };
}

// One block back to its normal settings.
export function resetBlock(doc: PageDoc, type: BlockType): EditResult {
  const at = indexOf(doc, type);
  if (at < 0) return refuse(doc, "That block is not on the page.");
  const blocks = doc.blocks.slice();
  blocks[at] = { ...blocks[at], settings: defaultSettings(type) } as Block;
  const next = { ...doc, blocks };
  return JSON.stringify(next) === JSON.stringify(doc) ? refuse(doc) : done(next);
}
