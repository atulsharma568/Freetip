import type { Block, BlockType, PageDoc, SettingsByType, Slot } from "./types";

// What each block type is allowed to be. Pure data, so a later phase widens it by editing a table.

export const BLOCK_TYPES: readonly BlockType[] = [
  "backdrop",
  "header",
  "creatorLinks",
  "alertPreview",
  "qr",
  "amount",
  "note",
  "send",
  "strip",
  "successScreen",
];

// Where a block may sit. The first entry is its own section, where it goes when the stored one is
// not allowed. Phase 1 gives every type exactly one section.
export const ALLOWED_SLOTS: Record<BlockType, readonly Slot[]> = {
  backdrop: ["background"],
  header: ["side"],
  creatorLinks: ["side"],
  alertPreview: ["side"],
  qr: ["side"],
  amount: ["main"],
  note: ["main"],
  send: ["main"],
  strip: ["bottom"],
  successScreen: ["success"],
};

// The blocks a fan pays with. They can be restyled and re-worded but never hidden or removed:
// the page must always be payable.
export const PROTECTED: readonly BlockType[] = ["amount", "note", "send"];

export const LIMITS = {
  blocks: 30,
  // A stored document handed back as text is read only up to this many characters.
  raw: 100_000,
  tagline: 60,
  strip: 40,
  levelName: 24,
  levels: { min: 2, max: 8 },
  topRupees: { min: 100, max: 100_000 },
  instagram: 30,
} as const;

export function isBlockType(value: unknown): value is BlockType {
  return typeof value === "string" && (BLOCK_TYPES as readonly string[]).includes(value);
}

const DEFAULTS: { [K in BlockType]: () => SettingsByType[K] } = {
  backdrop: () => ({ style: "ember" }),
  header: () => ({}),
  creatorLinks: () => ({ tagline: "", instagram: "" }),
  alertPreview: () => ({}),
  qr: () => ({}),
  amount: () => ({ ladder: null }),
  note: () => ({}),
  send: () => ({}),
  strip: () => ({ left: "", right: "" }),
  successScreen: () => ({ style: "default" }),
};

// A fresh settings object for a type, with everything at its normal value.
export function defaultSettings<T extends BlockType>(type: T): SettingsByType[T] {
  return DEFAULTS[type]() as SettingsByType[T];
}

// The first block of a type, or undefined. Hidden blocks are returned too; the caller decides
// whether `visible` matters (the success screen, for one, is always shown).
export function findBlock<T extends BlockType>(doc: PageDoc, type: T): Block<T> | undefined {
  return doc.blocks.find((b) => b.type === type) as Block<T> | undefined;
}
