import { GROUND, MIN_GROUND_CONTRAST, contrast, inkFor, pairChecks } from "../accent";
import { cleanAssetId, replaceAssetId, usedAssetIds, type AssetKind } from "./assets";
import { ALLOWED_SLOTS, BLOCK_LABELS, LIMITS, PROTECTED, defaultSettings } from "./blocks";
import { findChoiceField, findRangeField, findTextField } from "./fields";
import type { Block, BlockType, Ladder, Level, PageDoc } from "./types";

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

// Moves a block to where another block of the same section is (the drop of a drag). Another
// section, or the same place, changes nothing.
export function moveBlockTo(doc: PageDoc, type: BlockType, target: BlockType): EditResult {
  const from = indexOf(doc, type);
  const to = indexOf(doc, target);
  if (from < 0 || to < 0) return refuse(doc, "That block is not on the page.");
  if (doc.blocks[from].slot !== doc.blocks[to].slot) return refuse(doc, "A block can only move inside its own section.");
  // The number of places between them is fixed before the first step: each step moves the
  // target too, so comparing again would send the block back.
  // They are counted among the blocks of their own section only (other sections may lie between
  // them in the list).
  const section = doc.blocks.filter((b) => b.slot === doc.blocks[from].slot).map((b) => b.type);
  const distance = Math.abs(section.indexOf(type) - section.indexOf(target));
  const direction = section.indexOf(type) < section.indexOf(target) ? "down" : "up";
  let next = doc;
  for (let step = 0; step < distance; step++) next = moveBlock(next, type, direction).doc;
  return next === doc ? refuse(doc) : done(next);
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

// Everything wrong with rank words, in plain English. Empty means the parser will keep them.
export function validateLevels(levels: readonly Level[]): string[] {
  const problems: string[] = [];
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

// Everything wrong with a ladder, in plain English. Empty means the parser will keep it as it is.
export function validateLadder(ladder: Ladder): string[] {
  const problems: string[] = [];
  const { topRupees } = ladder;
  if (!Number.isFinite(topRupees) || topRupees < LIMITS.topRupees.min || topRupees > LIMITS.topRupees.max) {
    problems.push(`The top of the bar must be between ₹${LIMITS.topRupees.min} and ₹${LIMITS.topRupees.max.toLocaleString("en-IN")}.`);
  }
  return [...problems, ...validateLevels(ladder.levels)];
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

// Puts a block the page does not have yet back on it (the owner's backdrop, for a creator whose
// page had none). Only a type that is missing can be added, in its own section: first for the
// backdrop (it sits behind everything), under the header and links for the Pressure meter, last
// otherwise. A backdrop added this way is the picture
// kind, because the smoke and embers are the owner's own look.
export function addBlock(doc: PageDoc, type: BlockType): EditResult {
  if (indexOf(doc, type) >= 0) return refuse(doc, `The page already has a ${BLOCK_LABELS[type]} block.`);
  const settings = type === "backdrop" ? { ...defaultSettings("backdrop"), style: "media" as const } : defaultSettings(type);
  const added = { id: type, type, visible: true, slot: ALLOWED_SLOTS[type][0], settings } as Block;
  if (type === "backdrop") return done({ ...doc, blocks: [added, ...doc.blocks] });
  if (type === "pressureMeter") {
    // Under the header and the links, before the alert preview.
    let after = -1;
    doc.blocks.forEach((b, i) => {
      if (b.type === "header" || b.type === "creatorLinks") after = i;
    });
    const blocks = doc.blocks.slice();
    blocks.splice(after + 1, 0, added);
    return done({ ...doc, blocks });
  }
  return done({ ...doc, blocks: [...doc.blocks, added] });
}

// Sets one number on a slider, kept inside the field's own range.
export function setNumber(doc: PageDoc, type: BlockType, key: string, value: number): EditResult {
  const at = indexOf(doc, type);
  const field = findRangeField(type, key);
  if (at < 0 || !field) return refuse(doc, "That setting does not exist.");
  if (!Number.isFinite(value)) return refuse(doc, `${field.label} must be a number.`);
  const n = Math.round(value);
  if (n < field.min || n > field.max) return refuse(doc, `${field.label} must be between ${field.min} and ${field.max}.`);
  if ((doc.blocks[at].settings as Record<string, unknown>)[key] === n) return refuse(doc);
  return done(withSettings(doc, at, { [key]: n }));
}

// The picture of a block: an id from the library, or null for none. Whether the file fits the place
// is the editor's picker's job (it lists only files that fit); the page draws the normal look for a
// file that does not.
// The header has three places for a file; `place` says which, and is the banner when left out.
const ASSET_KEYS: Partial<Record<BlockType, readonly string[]>> = {
  backdrop: ["asset"],
  header: ["bannerAsset", "frameAsset", "bannerFxAsset"],
  pressureMeter: ["picture"],
};

export function setAsset(doc: PageDoc, type: BlockType, id: number | null, place?: string): EditResult {
  const at = indexOf(doc, type);
  const keys = ASSET_KEYS[type];
  const key = keys && (place === undefined ? keys[0] : keys.find((k) => k === place));
  if (at < 0 || !key) return refuse(doc, "That block does not take a picture.");
  if (id !== null && cleanAssetId(id) === null) return refuse(doc, "That picture is not valid.");
  if ((doc.blocks[at].settings as Record<string, unknown>)[key] === id) return refuse(doc);
  return done(withSettings(doc, at, { [key]: id }));
}

// Every place that shows one file shows another instead ("Replace"). Nothing changes if the first
// file is not used.
// `toKind` is the new file's kind: a place that cannot take it (a video as a banner) keeps the old
// file, and if no place can, nothing changes and the editor is told why.
export function swapAsset(doc: PageDoc, from: number, to: number, toKind?: AssetKind): EditResult {
  if (cleanAssetId(from) === null || cleanAssetId(to) === null) return refuse(doc, "That picture is not valid.");
  const out = replaceAssetId(doc, from, to, toKind);
  if (out.changed) return done(out.doc);
  return usedAssetIds(doc).includes(from) ? refuse(doc, "The new file cannot be used where the old one was.") : refuse(doc);
}

// The Pressure meter's own settings (the words and the text and choice fields go through setText
// and setChoice like any block's). Each of these refuses a value the parser would change.

function meterAt(doc: PageDoc): number {
  return indexOf(doc, "pressureMeter");
}

const NO_METER = "The page has no Pressure meter.";

// A goal of the creator by id, or null for "the first goal". Whether the id is the creator's own
// is the picker's job (it lists only theirs) and the reading's (it ignores any other).
export function setMeterGoal(doc: PageDoc, goal: number | null): EditResult {
  const at = meterAt(doc);
  if (at < 0) return refuse(doc, NO_METER);
  if (goal !== null && cleanAssetId(goal) === null) return refuse(doc, "That goal is not valid.");
  if ((doc.blocks[at].settings as Record<string, unknown>).goal === goal) return refuse(doc);
  return done(withSettings(doc, at, { goal }));
}

export function setMeterLevels(doc: PageDoc, levels: readonly Level[]): EditResult {
  const at = meterAt(doc);
  if (at < 0) return refuse(doc, NO_METER);
  const problems = validateLevels(levels);
  if (problems.length > 0) return refuse(doc, ...problems);
  return done(withSettings(doc, at, { levels: levels.map((l) => ({ upTo: l.upTo, name: l.name })) }));
}

export function setMeterCelebrate(doc: PageDoc, celebrate: boolean): EditResult {
  const at = meterAt(doc);
  if (at < 0) return refuse(doc, NO_METER);
  if ((doc.blocks[at].settings as Record<string, unknown>).celebrate === celebrate) return refuse(doc);
  return done(withSettings(doc, at, { celebrate }));
}

// The bar colour, or null for the page accent. It has to be seen on the page ground (3 to 1).
export function setMeterFill(doc: PageDoc, fill: string | null): EditResult {
  const at = meterAt(doc);
  if (at < 0) return refuse(doc, NO_METER);
  let value: string | null = null;
  if (fill !== null) {
    value = fill.trim().toLowerCase();
    if (!HEX.test(value)) return refuse(doc, "Colours are written as #rrggbb.");
    const ratio = contrast(value, GROUND);
    if (ratio < MIN_GROUND_CONTRAST) return refuse(doc, `This colour on the page is ${ratio.toFixed(1)} to 1; it needs ${MIN_GROUND_CONTRAST}.`);
  }
  if ((doc.blocks[at].settings as Record<string, unknown>).fill === value) return refuse(doc);
  return done(withSettings(doc, at, { fill: value }));
}
