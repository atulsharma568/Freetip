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
  | "successScreen"
  | "pressureMeter";

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

// Words a block may change are plain text, empty by default. Empty means the standard wording,
// which stays in the component, so a document that sets nothing looks exactly as before.
export interface SettingsByType {
  // "ember" is the owner's smoke and embers; "media" draws a picture, GIF or video of the library
  // (`asset`, an id in page_assets) under a layer of the page colour, `dim` percent thick. A media
  // backdrop with no readable asset draws nothing, so the page is plain.
  backdrop: { style: "ember" | "media"; asset: number | null; dim: number };
  // `bannerAsset` (an id in page_assets, a picture or GIF) replaces the creator's own banner.
  header: { bannerAsset: number | null };
  creatorLinks: { tagline: string; instagram: string };
  alertPreview: { label: string };
  qr: Record<string, never>;
  // A null ladder means no bar in the amount box.
  amount: { ladder: Ladder | null; heading: string; barLabel: string };
  note: { heading: string; namePlaceholder: string; messagePlaceholder: string };
  // The amount is always added after the button label; it is not a setting.
  send: { heading: string; buttonLabel: string };
  strip: { left: string; right: string };
  successScreen: { style: "default" | "owner"; line: string };
  // A creator's goal drawn as a bar (phase 4). `goal` is a goal id of the creator, none meaning
  // their first goal. `levels` are the rank words in fractions of the goal (a linear scale, apart
  // from the amount block's ladder). `show` "percent" keeps every rupee figure off the page and
  // out of what the server sends. `where` is the tip page, OBS or both. `fill` is the bar colour,
  // none meaning the page accent. An empty heading means "Pressure".
  pressureMeter: {
    goal: number | null;
    levels: Level[];
    show: "rupees" | "percent";
    where: "both" | "page" | "obs";
    celebrate: boolean;
    fill: string | null;
    heading: string;
  };
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
