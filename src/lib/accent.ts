// A creator's accent colour for their tip page. Pure rules, no I/O.
//
// The page is dark, so the accent is used both as a fill (with dark ink on it)
// and as text on the dark ground. Every colour that can be stored is therefore
// one of the presets below or an "auto" colour pulled from the profile picture
// and pulled into a readable lightness band. Nothing free-form is accepted.

export const DEFAULT_ACCENT = "#bfe84a";

export interface AccentPreset {
  id: string;
  label: string;
  hex: string;
}

export const ACCENT_PRESETS: readonly AccentPreset[] = [
  { id: "lime", label: "Lime", hex: DEFAULT_ACCENT },
  { id: "sky", label: "Sky", hex: "#7dd3fc" },
  { id: "mint", label: "Mint", hex: "#6ee7b7" },
  { id: "amber", label: "Amber", hex: "#fcd34d" },
  { id: "orange", label: "Orange", hex: "#fdba74" },
  { id: "coral", label: "Coral", hex: "#fda4af" },
  { id: "pink", label: "Pink", hex: "#f9a8d4" },
  { id: "violet", label: "Violet", hex: "#c4b5fd" },
  { id: "periwinkle", label: "Periwinkle", hex: "#a5b4fc" },
  { id: "white", label: "White", hex: "#f1f1ec" },
];

const HEX = /^#[0-9a-f]{6}$/;

// The page's dark ground and the two inks used on top of an accent fill.
export const GROUND = "#0f100c";
const INK_DARK = "#14170a";
const INK_LIGHT = "#f6f6f1";

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// The ink to put on an accent fill: dark, unless dark is the weaker choice.
export function inkFor(accent: string): string {
  return contrast(accent, INK_DARK) >= contrast(accent, INK_LIGHT) ? INK_DARK : INK_LIGHT;
}

// What a page document's colour pair must satisfy: the ink on the accent like small text (4.5 to
// 1), and the accent on the page ground like large text, fills and focus rings (3 to 1; small
// text on the page stays white or grey, so the owner's red passes).
export const MIN_INK_CONTRAST = 4.5;
export const MIN_GROUND_CONTRAST = 3;

export function pairChecks(accent: string, ink: string): { inkOnAccent: number; accentOnGround: number; ok: boolean } {
  const inkOnAccent = contrast(accent, ink);
  const accentOnGround = contrast(accent, GROUND);
  return { inkOnAccent, accentOnGround, ok: inkOnAccent >= MIN_INK_CONTRAST && accentOnGround >= MIN_GROUND_CONTRAST };
}

// Readable both as a fill and as text on the page ground.
export function isReadable(accent: string): boolean {
  return HEX.test(accent) && contrast(accent, GROUND) >= 4.5 && contrast(accent, inkFor(accent)) >= 4.5;
}

// A stored value is trusted only if it is lower-case hex and readable. Anything
// else (an old value, a hand-edited row) falls back to the default.
export function safeAccent(stored: string | null | undefined): string {
  const v = (stored ?? "").trim().toLowerCase();
  return isReadable(v) ? v : DEFAULT_ACCENT;
}

export function presetHex(id: string): string | null {
  return ACCENT_PRESETS.find((p) => p.id === id)?.hex ?? null;
}

// Inline style for a wrapper: re-points the page's two colour tokens.
export function accentStyle(stored: string | null | undefined): Record<string, string> | undefined {
  const accent = safeAccent(stored);
  if (accent === DEFAULT_ACCENT) return undefined;
  return { "--color-accent": accent, "--color-ink": inkFor(accent) };
}

// ── "Auto from my picture" ──────────────────────────────────────────────────

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h / 6, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Picks the picture's dominant colour (weighted towards vivid pixels, ignoring
// near-black and near-white) and pulls it into a readable band. Takes raw RGB
// triples so it stays pure. Returns null when the picture has no usable colour,
// for example a grey logo; the caller then keeps the default.
export function accentFromPixels(pixels: ArrayLike<number>): string | null {
  const buckets = new Map<number, { weight: number; sin: number; cos: number; s: number; n: number }>();
  for (let i = 0; i + 2 < pixels.length; i += 3) {
    const [h, s, l] = rgbToHsl(pixels[i], pixels[i + 1], pixels[i + 2]);
    if (s < 0.25 || l < 0.12 || l > 0.92) continue;
    const key = Math.floor(h * 24) % 24;
    const w = s * (1 - Math.abs(l - 0.5));
    const b = buckets.get(key) ?? { weight: 0, sin: 0, cos: 0, s: 0, n: 0 };
    b.weight += w;
    b.sin += Math.sin(h * 2 * Math.PI) * w;
    b.cos += Math.cos(h * 2 * Math.PI) * w;
    b.s += s;
    b.n += 1;
    buckets.set(key, b);
  }
  let best: { weight: number; sin: number; cos: number; s: number; n: number } | null = null;
  for (const b of buckets.values()) if (!best || b.weight > best.weight) best = b;
  if (!best || best.n < 8) return null;
  const hue = ((Math.atan2(best.sin, best.cos) / (2 * Math.PI)) + 1) % 1;
  const sat = Math.min(0.85, Math.max(0.45, best.s / best.n));
  // Walk the lightness up until the colour reads on the dark page.
  for (let l = 0.66; l <= 0.9; l += 0.02) {
    const hex = hslToHex(hue, sat, l);
    if (isReadable(hex)) return hex;
  }
  return null;
}
