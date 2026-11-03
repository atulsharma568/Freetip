import { contrast, inkFor } from "../accent";
import { ALLOWED_SLOTS, LIMITS, PROTECTED, defaultSettings, isBlockType } from "./blocks";
import { PAGE_DOC_VERSION, type Block, type BlockType, type Ladder, type PageDoc, type SettingsByType, type Slot, type Theme } from "./types";

// The one place a stored page document is read. It never throws and never gives back something a
// fan cannot pay on: anything invalid is dropped or replaced on its own (a bad colour, a long
// word, an unknown block), and a missing or hidden pay block is put back. Only a value that is
// not a page at all gives null, and callers then use the normal page.

export interface ParsedPage {
  doc: PageDoc;
  // The pay blocks (in amount, note, send order) that were missing or hidden and have been put
  // back. Empty for a clean document.
  repairedProtected: BlockType[];
}

const HEX = /^#[0-9a-f]{6}$/;
const INSTAGRAM = new RegExp(`^[A-Za-z0-9._]{1,${LIMITS.instagram}}$`);
const CONTROL = /[\u0000-\u001f\u007f]/g;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// Control characters out, trimmed, cut at the limit (by whole characters). Not a string is "".
function cleanText(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return Array.from(v.replace(CONTROL, "").trim()).slice(0, max).join("");
}

function hex(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const lower = v.trim().toLowerCase();
  return HEX.test(lower) ? lower : null;
}

function parseLadder(raw: unknown): Ladder | null {
  if (!isObject(raw)) return null;
  const top = raw.topRupees;
  if (typeof top !== "number" || !Number.isFinite(top) || top < LIMITS.topRupees.min || top > LIMITS.topRupees.max) return null;
  const levels = raw.levels;
  if (!Array.isArray(levels) || levels.length < LIMITS.levels.min || levels.length > LIMITS.levels.max) return null;
  const out: Ladder["levels"] = [];
  let previous = 0;
  for (const level of levels) {
    if (!isObject(level)) return null;
    const upTo = level.upTo;
    const name = cleanText(level.name, LIMITS.levelName);
    if (typeof upTo !== "number" || !Number.isFinite(upTo) || upTo <= previous || upTo > 1 || !name) return null;
    out.push({ upTo, name });
    previous = upTo;
  }
  if (out[out.length - 1].upTo !== 1) return null;
  return { topRupees: top, levels: out };
}

const SETTINGS: { [K in BlockType]: (raw: Record<string, unknown>) => SettingsByType[K] } = {
  backdrop: () => ({ style: "ember" }),
  header: () => ({}),
  creatorLinks: (raw) => ({
    tagline: cleanText(raw.tagline, LIMITS.tagline),
    instagram: typeof raw.instagram === "string" && INSTAGRAM.test(raw.instagram) ? raw.instagram : "",
  }),
  alertPreview: () => ({}),
  qr: () => ({}),
  amount: (raw) => ({ ladder: parseLadder(raw.ladder) }),
  note: () => ({}),
  send: () => ({}),
  strip: (raw) => ({ left: cleanText(raw.left, LIMITS.strip), right: cleanText(raw.right, LIMITS.strip) }),
  successScreen: (raw) => ({ style: raw.style === "owner" ? "owner" : "default" }),
};

function parseSettings<T extends BlockType>(type: T, raw: unknown): SettingsByType[T] {
  return (isObject(raw) ? SETTINGS[type](raw) : defaultSettings(type)) as SettingsByType[T];
}

// A colour pair is kept only if the ink can be read on the accent (4.5 to 1). Ink alone means
// nothing, so it is dropped with its accent.
function parseTheme(raw: unknown): Theme {
  if (!isObject(raw)) return {};
  const accent = hex(raw.accent);
  if (!accent) return {};
  const ink = hex(raw.ink);
  if (contrast(accent, ink ?? inkFor(accent)) < 4.5) return {};
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

  const blocks: Block[] = [];
  const seen = new Set<BlockType>();
  const repaired = new Set<BlockType>();
  for (const entry of value.blocks.slice(0, LIMITS.blocks)) {
    if (!isObject(entry) || !isBlockType(entry.type) || seen.has(entry.type)) continue;
    const type = entry.type;
    seen.add(type);
    const allowed = ALLOWED_SLOTS[type];
    const slot: Slot = typeof entry.slot === "string" && (allowed as readonly string[]).includes(entry.slot) ? (entry.slot as Slot) : allowed[0];
    const hidden = entry.visible === false;
    const isProtected = PROTECTED.includes(type);
    if (isProtected && hidden) repaired.add(type);
    blocks.push({ id: type, type, visible: isProtected ? true : !hidden, slot, settings: parseSettings(type, entry.settings) } as Block);
  }
  for (const type of PROTECTED) {
    if (seen.has(type)) continue;
    repaired.add(type);
    blocks.push({ id: type, type, visible: true, slot: ALLOWED_SLOTS[type][0], settings: defaultSettings(type) } as Block);
  }

  return {
    doc: { version: PAGE_DOC_VERSION, blocks, theme: parseTheme(value.theme) },
    repairedProtected: PROTECTED.filter((t) => repaired.has(t)),
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

// What publishing checks: a draft that is not a page, or that hides or drops a pay block, is
// refused (rendering would repair it, but the owner should be told).
export function validateForPublish(raw: unknown): { ok: true; doc: PageDoc } | { ok: false; message: string } {
  const parsed = parsePageDoc(raw);
  if (!parsed) return { ok: false, message: "This draft is not a page." };
  if (parsed.repairedProtected.length > 0) return { ok: false, message: "The amount, note and send blocks must stay on the page." };
  return { ok: true, doc: parsed.doc };
}
