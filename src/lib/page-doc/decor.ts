// The animated frame over a creator's photo and the effect over their banner (the way Discord's
// avatar decorations and profile effects work): a choice from a short list of ready-made looks that
// are drawn in CSS (so no file is loaded and they follow the page accent), or "custom", a picture or
// GIF the owner uploaded to the page's library. Pure, so the parser, the editor and the tests share it.

export const FRAME_STYLES = ["none", "flame", "aura", "slash", "custom"] as const;
export type FrameStyle = (typeof FRAME_STYLES)[number];

export const BANNER_FX = ["none", "embers", "slashes", "shimmer", "clutch", "custom"] as const;
export type BannerFx = (typeof BANNER_FX)[number];

export const FRAME_OPTIONS: { value: FrameStyle; label: string }[] = [
  { value: "none", label: "No frame" },
  { value: "flame", label: "Flame ring" },
  { value: "aura", label: "Pulsing aura with sparks" },
  { value: "slash", label: "Slash ring" },
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
