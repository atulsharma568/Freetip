import { inkFor, pairChecks } from "../accent";
import { ALLOWED_SLOTS, BLOCK_LABELS, INSTAGRAM_PATTERN, LIMITS, PROTECTED, defaultSettings, isBlockType } from "./blocks";
import { PAGE_DOC_VERSION, type Block, type BlockType, type Ladder, type PageDoc, type SettingsByType, type Slot, type Theme } from "./types";

// The one place a stored page document is read. It never throws and never gives back something a
// fan cannot pay on: anything invalid is dropped or replaced on its own (a bad colour, a long
// word, an unknown block), and a missing or hidden protected block is put back. Only a value that
// is not a page at all gives null, and callers then use the normal page.

export interface ParsedPage {
  doc: PageDoc;
  // The protected blocks (in header, amount, note, send order) that were missing or hidden and
  // have been put back. Empty for a clean document.
  repairedProtected: BlockType[];
  // One plain sentence for each thing that was cut, dropped or put back. Empty for a clean
  // document. The editor shows these after a save.
  notes: string[];
}

const HEX = /^#[0-9a-f]{6}$/;
const CONTROL = /[\u0000-\u001f\u007f]/g;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// Collects the notes, without repeats.
class Notes {
  readonly list: string[] = [];
  add(message: string) {
    if (!this.list.includes(message)) this.list.push(message);
  }
}

// Control characters out, trimmed, cut at the limit (by whole characters). Not a string is "".
// Only a cut is worth telling the owner about, and a value that is not text at all.
function cleanText(v: unknown, max: number, notes: Notes, label: string): string {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") {
    notes.add(`${label} was not text and was removed.`);
    return "";
  }
  const chars = Array.from(v.replace(CONTROL, "").trim());
  if (chars.length > max) notes.add(`${label} was cut to ${max} letters.`);
  return chars.slice(0, max).join("");
}

function hex(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const lower = v.trim().toLowerCase();
  return HEX.test(lower) ? lower : null;
}

function parseLadder(raw: unknown, notes: Notes): Ladder | null {
  if (raw === undefined || raw === null) return null;
  const dropped = () => {
    notes.add("The rank words were not valid, so the bar was removed.");
    return null;
  };
  if (!isObject(raw)) return dropped();
  const top = raw.topRupees;
  if (typeof top !== "number" || !Number.isFinite(top) || top < LIMITS.topRupees.min || top > LIMITS.topRupees.max) return dropped();
  const levels = raw.levels;
  if (!Array.isArray(levels) || levels.length < LIMITS.levels.min || levels.length > LIMITS.levels.max) return dropped();
  const out: Ladder["levels"] = [];
  let previous = 0;
  for (const level of levels) {
    if (!isObject(level)) return dropped();
    const upTo = level.upTo;
    const name = cleanText(level.name, LIMITS.levelName, notes, "A rank name");
    if (typeof upTo !== "number" || !Number.isFinite(upTo) || upTo <= previous || upTo > 1 || !name) return dropped();
    out.push({ upTo, name });
    previous = upTo;
  }
  if (out[out.length - 1].upTo !== 1) return dropped();
  return { topRupees: top, levels: out };
}

const SETTINGS: { [K in BlockType]: (raw: Record<string, unknown>, notes: Notes) => SettingsByType[K] } = {
  backdrop: () => ({ style: "ember" }),
  header: () => ({}),
  creatorLinks: (raw, notes) => {
    const instagram = typeof raw.instagram === "string" && INSTAGRAM_PATTERN.test(raw.instagram) ? raw.instagram : "";
    if (raw.instagram !== undefined && raw.instagram !== "" && !instagram) notes.add("The Instagram handle was not valid and was removed.");
    return { tagline: cleanText(raw.tagline, LIMITS.tagline, notes, "The tagline"), instagram };
  },
  alertPreview: (raw, notes) => ({ label: cleanText(raw.label, LIMITS.previewLabel, notes, "The alert preview label") }),
  qr: () => ({}),
  amount: (raw, notes) => ({
    ladder: parseLadder(raw.ladder, notes),
    heading: cleanText(raw.heading, LIMITS.heading, notes, "The amount heading"),
    barLabel: cleanText(raw.barLabel, LIMITS.barLabel, notes, "The bar label"),
  }),
  note: (raw, notes) => ({
    heading: cleanText(raw.heading, LIMITS.heading, notes, "The note heading"),
    namePlaceholder: cleanText(raw.namePlaceholder, LIMITS.namePlaceholder, notes, "The name hint"),
    messagePlaceholder: cleanText(raw.messagePlaceholder, LIMITS.messagePlaceholder, notes, "The message hint"),
  }),
  send: (raw, notes) => ({
    heading: cleanText(raw.heading, LIMITS.heading, notes, "The send heading"),
    buttonLabel: cleanText(raw.buttonLabel, LIMITS.buttonLabel, notes, "The button word"),
  }),
  strip: (raw, notes) => ({
    left: cleanText(raw.left, LIMITS.strip, notes, "The strip text"),
    right: cleanText(raw.right, LIMITS.strip, notes, "The strip text"),
  }),
  successScreen: (raw, notes) => ({
    style: raw.style === "owner" ? "owner" : "default",
    line: cleanText(raw.line, LIMITS.successLine, notes, "The thank-you line"),
  }),
};

function parseSettings<T extends BlockType>(type: T, raw: unknown, notes: Notes): SettingsByType[T] {
  return (isObject(raw) ? SETTINGS[type](raw, notes) : defaultSettings(type)) as SettingsByType[T];
}

// A colour pair is kept only if the ink can be read on the accent (4.5 to 1) and the accent can
// be seen on the page ground (3 to 1). Ink alone means nothing, so it is dropped with its accent.
function parseTheme(raw: unknown, notes: Notes): Theme {
  if (!isObject(raw)) return {};
  const accent = hex(raw.accent);
  const ink = hex(raw.ink);
  if (raw.accent === undefined && raw.ink === undefined) return {};
  if (!accent) {
    notes.add("The page colours were dropped: the accent is not a valid #rrggbb colour.");
    return {};
  }
  if (raw.ink !== undefined && !ink) {
    notes.add("The page colours were dropped: the ink is not a valid #rrggbb colour.");
    return {};
  }
  const checks = pairChecks(accent, ink ?? inkFor(accent));
  if (!checks.ok) {
    notes.add(
      `The page colours were dropped: the text on the colour is ${checks.inkOnAccent.toFixed(1)} to 1 (needs 4.5) and the colour on the page is ${checks.accentOnGround.toFixed(1)} to 1 (needs 3).`,
    );
    return {};
  }
  return ink ? { accent, ink } : { accent };
}

function readPage(raw: unknown): ParsedPage | null {
  let value = raw;
  if (typeof value === "string") {
    // A driver may hand jsonb back as text; read it either way, but not without limit.
    if (value.length > LIMITS.raw) return null;
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!isObject(value) || value.version !== PAGE_DOC_VERSION || !Array.isArray(value.blocks)) return null;

  const notes = new Notes();
  const blocks: Block[] = [];
  const seen = new Set<BlockType>();
  const repaired = new Set<BlockType>();
  if (value.blocks.length > LIMITS.blocks) notes.add("Blocks past the first 30 were ignored.");
  for (const entry of value.blocks.slice(0, LIMITS.blocks)) {
    if (!isObject(entry) || !isBlockType(entry.type)) {
      notes.add("A block that does not exist was removed.");
      continue;
    }
    const type = entry.type;
    if (seen.has(type)) {
      notes.add(`A second ${BLOCK_LABELS[type]} block was removed.`);
      continue;
    }
    seen.add(type);
    const allowed = ALLOWED_SLOTS[type];
    const slotOk = typeof entry.slot === "string" && (allowed as readonly string[]).includes(entry.slot);
    const slot: Slot = slotOk ? (entry.slot as Slot) : allowed[0];
    if (!slotOk) notes.add(`The ${BLOCK_LABELS[type]} block was moved back to its own section.`);
    const hidden = entry.visible === false;
    const isProtected = PROTECTED.includes(type);
    if (isProtected && hidden) {
      repaired.add(type);
      notes.add(`The ${BLOCK_LABELS[type]} block cannot be hidden, so it was shown again.`);
    }
    blocks.push({ id: type, type, visible: isProtected ? true : !hidden, slot, settings: parseSettings(type, entry.settings, notes) } as Block);
  }
  for (const type of PROTECTED) {
    if (seen.has(type)) continue;
    repaired.add(type);
    notes.add(`The ${BLOCK_LABELS[type]} block was missing, so it was added back.`);
    const added = { id: type, type, visible: true, slot: ALLOWED_SLOTS[type][0], settings: defaultSettings(type) } as Block;
    // The header goes first, so the page still starts with who it is for.
    if (type === "header") blocks.unshift(added);
    else blocks.push(added);
  }

  return {
    doc: { version: PAGE_DOC_VERSION, blocks, theme: parseTheme(value.theme, notes) },
    repairedProtected: PROTECTED.filter((t) => repaired.has(t)),
    notes: notes.list,
  };
}

// null means "not a usable document at all".
export function parsePageDoc(raw: unknown): ParsedPage | null {
  try {
    return readPage(raw);
  } catch {
    return null;
  }
}

// The cleaned document, or the page the caller would show anyway.
export function pageDocOrDefault(raw: unknown, fallback: PageDoc): PageDoc {
  return parsePageDoc(raw)?.doc ?? fallback;
}

// What publishing checks: a draft that is not a page, or that hides or drops a protected block, is
// refused (rendering would repair it, but the owner should be told).
export function validateForPublish(raw: unknown): { ok: true; doc: PageDoc } | { ok: false; message: string } {
  const parsed = parsePageDoc(raw);
  if (!parsed) return { ok: false, message: "This draft is not a page." };
  if (parsed.repairedProtected.length > 0) return { ok: false, message: "The header, amount, note and send blocks must stay on the page." };
  return { ok: true, doc: parsed.doc };
}
