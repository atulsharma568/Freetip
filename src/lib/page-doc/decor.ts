import type { PageDoc } from "./types";

// The animated frame over a creator's photo and the effect over their banner (the way Discord's
// avatar decorations and profile effects work): a choice from a short list of ready-made looks that
// are drawn in CSS (so no file is loaded and they follow the page accent), or "custom", a picture or
// GIF the owner uploaded to the page's library. Pure, so the parser, the editor and the tests share it.

export const FRAME_STYLES = ["none", "flame", "aura", "slash", "foxfire", "custom"] as const;
export type FrameStyle = (typeof FRAME_STYLES)[number];

export const BANNER_FX = ["none", "embers", "slashes", "shimmer", "clutch", "custom"] as const;
export type BannerFx = (typeof BANNER_FX)[number];

export const FRAME_OPTIONS: { value: FrameStyle; label: string }[] = [
  { value: "none", label: "No frame" },
  { value: "flame", label: "Flame ring" },
  { value: "aura", label: "Pulsing aura with sparks" },
  { value: "slash", label: "Slash ring" },
  { value: "foxfire", label: "Fox-fire (flames crawl over the top of the photo)" },
  { value: "custom", label: "Your own picture or GIF" },
];

export const BANNER_FX_OPTIONS: { value: BannerFx; label: string }[] = [
  { value: "none", label: "No effect" },
  { value: "embers", label: "Rising embers" },
  { value: "slashes", label: "Sweeping slashes" },
  { value: "shimmer", label: "Soft glow sweep" },
  { value: "clutch", label: "Clutch pulse (heartbeat and crosshair lock-on)" },
  { value: "custom", label: "Your own picture or GIF" },
];

export const isFrameStyle = (v: unknown): v is FrameStyle => typeof v === "string" && (FRAME_STYLES as readonly string[]).includes(v);
export const isBannerFx = (v: unknown): v is BannerFx => typeof v === "string" && (BANNER_FX as readonly string[]).includes(v);

// How many little lights a ready-made effect draws. Fixed counts and fixed positions (computed from
// the index, never random), so the server's page and the browser's first draw agree.
export const EMBER_COUNT = 14;
export const SPARK_COUNT = 6;

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
