// The tip page as data (page builder phase 1). One document per creator: an ordered list of
// blocks and a small theme. It is stored as jsonb, so it is always read back through the parser
// in parse.ts and never trusted as it is. The words that matter to a payment (the message
// limit, the minimum tip, fee wording, the anonymous option, what the Pay button does) are not
// in here on purpose: they come from the real values, never from a document.

export const PAGE_DOC_VERSION = 1 as const;

// The places a block can sit. `side` is the left, sticky column on a laptop (on top on a phone),
// `main` is the form card, `bottom` is under the card, `background` sits behind everything and
// `success` is the screen that replaces the page after a tip.
export type Slot = "background" | "side" | "main" | "bottom" | "success";

export type BlockType =
  | "backdrop"
  | "header"
  | "creatorLinks"
  | "alertPreview"
  | "qr"
  | "amount"
  | "note"
  | "send"
  | "strip"
  | "successScreen";

// A rank on the amount bar: the word shows while the bar is below `upTo` (0 to 1).
export interface Level {
  upTo: number;
  name: string;
}

// The words under the amount bar. `topRupees` is the tip at which the bar is full.
export interface Ladder {
  topRupees: number;
  levels: Level[];
}

export interface SettingsByType {
  backdrop: { style: "ember" };
  header: Record<string, never>;
  creatorLinks: { tagline: string; instagram: string };
  alertPreview: Record<string, never>;
  qr: Record<string, never>;
  // A null ladder means no bar in the amount box.
  amount: { ladder: Ladder | null };
  note: Record<string, never>;
  send: Record<string, never>;
  strip: { left: string; right: string };
  successScreen: { style: "default" | "owner" };
}

export type Block<T extends BlockType = BlockType> = {
  [K in T]: { id: string; type: K; visible: boolean; slot: Slot; settings: SettingsByType[K] };
}[T];

// Colours for the whole page. Absent means the creator's own accent colour, as before.
export interface Theme {
  accent?: string;
  ink?: string;
}

export interface PageDoc {
  version: typeof PAGE_DOC_VERSION;
  blocks: Block[];
  theme: Theme;
}
