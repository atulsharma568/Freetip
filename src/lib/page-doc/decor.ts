import { hasFeature, type FeatureSource } from "../plans";
import type { PageDoc } from "./types";

// The animated frame over a creator's photo and the effect over their banner (the way Discord's
// avatar decorations and profile effects work): a choice from a short list of ready-made looks that
// are drawn in CSS (so no file is loaded and they follow the page accent) or are a finished animation
// that ships with the site, or "custom", a picture or GIF the owner uploaded to the page's library. Pure, so the parser, the editor and the tests share it.

export const FRAME_STYLES = ["none", "widow", "custom"] as const;
export type FrameStyle = (typeof FRAME_STYLES)[number];

// The ready-made animations that ship with the site, one file each (see FILE_FX below). Listed here
// so the stored value can be checked; the ids are the file names without the extension.
export const FILE_FX_IDS = [
  "peakyblinders", "sakura", "sololeveling", "applekitty", "toney", "eternal", "fkimgworkkk", "explosivecat", "killua", "angel", "nanami", "naoya",
] as const;

export const FILE_FX_INFO: Record<(typeof FILE_FX_IDS)[number], { label: string; file: string; still?: boolean }> = {
  peakyblinders: { label: "Peaky Blinders", file: "peaky-blinders" },
  sakura: { label: "Sakura", file: "sakura" },
  sololeveling: { label: "Solo Leveling", file: "solo-leveling" },
  applekitty: { label: "Apple kitty", file: "apple-kitty" },
  toney: { label: "Toney", file: "toney" },
  eternal: { label: "Eternal", file: "eternal" },
  fkimgworkkk: { label: "Fkimgworkkk", file: "fkimgworkkk" },
  explosivecat: { label: "Explosive cat", file: "explosive-cat" },
  killua: { label: "Killua", file: "killua" },
  angel: { label: "Angel", file: "angel", still: true },
  nanami: { label: "Nanami", file: "nanami" },
  naoya: { label: "Naoya", file: "naoya" },
};
export const BANNER_FX = ["none", "embers", "clutch", "petals", ...FILE_FX_IDS, "custom"] as const;
export type BannerFx = (typeof BANNER_FX)[number];

export const FRAME_OPTIONS: { value: FrameStyle; label: string }[] = [
  { value: "none", label: "No frame" },
  { value: "widow", label: "Black Widow (a spider walks the rim of the photo, small ones crawl over it)" },
  { value: "custom", label: "Your own picture or GIF" },
];

export const BANNER_FX_OPTIONS: { value: BannerFx; label: string }[] = [
  { value: "none", label: "No effect" },
  { value: "embers", label: "Rising embers" },
  { value: "clutch", label: "Clutch pulse (heartbeat and crosshair lock-on)" },
  { value: "petals", label: "Falling petals" },
  ...FILE_FX_IDS.map((id) => ({ value: id, label: `${FILE_FX_INFO[id].label} (animated picture)` })),
  { value: "custom", label: "Your own picture or GIF" },
];

// Frames that are a finished animation shipped with the site (drawn once by tools/decor-render and
// saved as an animated WebP with a still of its first frame), not drawn in CSS. `scale` is the size
// as a percent of the photo's ring, the same number as the `frameScale` setting of an uploaded frame.
export const FILE_FRAMES = {
  widow: { url: "/decorations/black-widow.webp", posterUrl: "/decorations/black-widow.poster.webp", scale: 220 },
} as const;
export type FileFrame = keyof typeof FILE_FRAMES;
export const isFileFrame = (v: string): v is FileFrame => Object.hasOwn(FILE_FRAMES, v);

// Effects that are a finished animation too: ready-made animated pictures (the files in
// public/decorations, converted to animated WebP by tools/decor-render/import-gifs.mjs, each with a
// still of its first frame). They are opaque pictures, so they play over the banner strip, cut to
// fit; `wholeHeader` is for a see-through animation made for the whole header (none ships now).
// They are third-party clips the owner chose to ship; see docs/avatar-decorations-plan.md.
export const FILE_FX: Record<
  (typeof FILE_FX_IDS)[number],
  { url: string; posterUrl: string; animated: boolean; wholeHeader: boolean }
> = Object.fromEntries(
  FILE_FX_IDS.map((id) => {
    const i = FILE_FX_INFO[id];
    return [id, { url: `/decorations/${i.file}.webp`, posterUrl: `/decorations/${i.file}.poster.webp`, animated: !i.still, wholeHeader: false }];
  }),
) as Record<(typeof FILE_FX_IDS)[number], { url: string; posterUrl: string; animated: boolean; wholeHeader: boolean }>;
export type FileFx = keyof typeof FILE_FX;
export const isFileFx = (v: string): v is FileFx => Object.hasOwn(FILE_FX, v);

// How big a picture or animation frame is drawn, as a percent of the photo (100 is the photo's own
// size; the ready-made rings are about 134). Standard is the size custom frames always had.
export const FRAME_SCALE = { min: 100, max: 220, step: 4, standard: 144 } as const;

// Where a picture or animation effect plays: only over the banner strip, or over the whole header
// (banner, photo, name and bio), the way a Discord profile effect covers the card.
export const FX_AREAS = ["banner", "header"] as const;
export type FxArea = (typeof FX_AREAS)[number];
export const FX_AREA_OPTIONS: { value: FxArea; label: string }[] = [
  { value: "banner", label: "Over the banner only" },
  { value: "header", label: "Over the whole header (banner, photo, name)" },
];
export const isFxArea = (v: unknown): v is FxArea => typeof v === "string" && (FX_AREAS as readonly string[]).includes(v);

export const isFrameStyle = (v: unknown): v is FrameStyle => typeof v === "string" && (FRAME_STYLES as readonly string[]).includes(v);
export const isBannerFx = (v: unknown): v is BannerFx => typeof v === "string" && (BANNER_FX as readonly string[]).includes(v);

// How many little lights a ready-made effect draws. Fixed counts and fixed positions (computed from
// the index, never random), so the server's page and the browser's first draw agree.
export const EMBER_COUNT = 14;
export const PETAL_COUNT = 12;

// A number between 0 and 1 that is always the same for the same index and salt.
export function steady(index: number, salt: number): number {
  const x = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// A creator's own pick from the dashboard (the owner's page for now): ready-made looks only, no
// uploaded files. Stored as jsonb in users.tip_decor; null means nothing was ever saved, and the page's
// own document decides.
export type PresetFrame = Exclude<FrameStyle, "custom">;
export type PresetBannerFx = Exclude<BannerFx, "custom">;
export interface TipDecor {
  frame: PresetFrame;
  bannerFx: PresetBannerFx;
}

export const PRESET_FRAMES: readonly PresetFrame[] = FRAME_STYLES.filter((f): f is PresetFrame => f !== "custom");
export const PRESET_BANNER_FX: readonly PresetBannerFx[] = BANNER_FX.filter((f): f is PresetBannerFx => f !== "custom");

// What is stored, read back leniently: anything that is not a ready-made look becomes "none". Not an
// object at all (nothing saved) gives null.
export function parseTipDecor(raw: unknown): TipDecor | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  return {
    frame: PRESET_FRAMES.find((f) => f === r.frame) ?? "none",
    bannerFx: PRESET_BANNER_FX.find((f) => f === r.bannerFx) ?? "none",
  };
}

// The page document with the creator's own pick in its header (and no uploaded file in those two
// places, since the pick replaces them). Nothing saved leaves the document as it is.
export function applyTipDecor(doc: PageDoc, decor: TipDecor | null): PageDoc {
  if (!decor) return doc;
  return {
    ...doc,
    blocks: doc.blocks.map((b) =>
      b.type === "header" ? { ...b, settings: { ...b.settings, frame: decor.frame, frameAsset: null, bannerFx: decor.bannerFx, bannerFxAsset: null } } : b,
    ),
  };
}

// Who may pick a frame and an effect on the dashboard: the owner's own page, or a creator the owner
// has switched "Photo frame and banner effects" on for.
export function mayPickTipDecor(ownerPage: boolean, row: FeatureSource): boolean {
  return ownerPage || hasFeature(row, "tipDecor");
}

// Whose saved pick the tip page wears. The owner's page always; a creator's only while their switch is
// on and no Custom tip page is on, because a done-for-you page decides its own frame and effect.
export function wearsTipDecor(ownerPage: boolean, row: FeatureSource): boolean {
  return ownerPage || (hasFeature(row, "tipDecor") && !hasFeature(row, "pageBuilder"));
}
