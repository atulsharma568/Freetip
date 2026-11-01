// Overlay themes and fonts for the OBS alert card (paid feature `overlayThemes`).
// Pure: no I/O, so the overlay, the dashboard preview and the tests share one list.
//
// A theme is a handful of CSS variables the alert card reads (see the CSS in
// src/components/overlay/AlertStage.tsx); a font is one of a fixed set loaded with
// next/font (src/components/overlay/fonts.ts). No uploaded fonts, no free-form
// colours: whatever is stored is a key from these lists, and an unknown key means
// the default, so a removed theme never breaks a creator's overlay.
//
// The creator's accent colour still applies: themes refer to it (`--ov-lime`) rather
// than carry their own colour, except Paper, which is the light card.

export type ThemeKey = "classic" | "midnight" | "paper" | "neon" | "blocky";
export type FontKey = "default" | "poppins" | "bangers" | "pixel" | "serif";

export const DEFAULT_THEME: ThemeKey = "classic";
export const DEFAULT_FONT: FontKey = "default";

// What the alert JSON carries (null while the feature is off or both are the default).
export type OverlayStyle = { theme: ThemeKey; font: FontKey };

export interface ThemeInfo {
  key: ThemeKey;
  label: string;
  description: string;
  // CSS custom properties set on the card. Empty for the default look.
  vars: Readonly<Record<string, string>>;
}

export const THEMES: readonly ThemeInfo[] = [
  {
    key: "classic",
    label: "Classic",
    description: "The Freetip card: your colour as the whole card, dark text.",
    vars: {},
  },
  {
    key: "midnight",
    label: "Midnight",
    description: "A dark card with your colour on the amount and the spoken words.",
    vars: {
      "--c-bg": "var(--ov-night)",
      "--c-fg": "var(--ov-chalk)",
      "--c-amount": "var(--ov-lime)",
      "--c-word-bg": "var(--ov-lime)",
      "--c-word-fg": "var(--ov-on-lime)",
      "--c-tag-bg": "var(--ov-lime)",
      "--c-tag-fg": "var(--ov-on-lime)",
    },
  },
  {
    key: "paper",
    label: "Paper",
    description: "A light card with dark text and a bar of your colour around it.",
    vars: {
      "--c-bg": "#f4f3ec",
      "--c-fg": "#14170a",
      "--c-word-bg": "#14170a",
      "--c-word-fg": "#f4f3ec",
      "--c-tag-bg": "#14170a",
      "--c-tag-fg": "#f4f3ec",
      "--c-border": "calc(var(--u) * 0.5) solid var(--ov-lime)",
    },
  },
  {
    key: "neon",
    label: "Neon",
    description: "A dark card with a glowing edge in your colour.",
    vars: {
      "--c-bg": "var(--ov-night)",
      "--c-fg": "var(--ov-chalk)",
      "--c-amount": "var(--ov-lime)",
      "--c-word-bg": "var(--ov-lime)",
      "--c-word-fg": "var(--ov-on-lime)",
      "--c-tag-bg": "var(--ov-lime)",
      "--c-tag-fg": "var(--ov-on-lime)",
      "--c-border": "calc(var(--u) * 0.3) solid var(--ov-lime)",
      "--c-shadow": "0 0 calc(var(--u) * 2.4) var(--ov-lime)",
    },
  },
  {
    key: "blocky",
    label: "Blocky",
    description: "Square corners, a thick dark edge and a hard shadow.",
    vars: {
      "--c-radius": "0px",
      "--c-radius-p": "0px",
      "--c-border": "calc(var(--u) * 0.45) solid var(--ov-night)",
      "--c-shadow": "calc(var(--u) * 0.9) calc(var(--u) * 0.9) 0 var(--ov-night)",
    },
  },
];

export interface FontInfo {
  key: FontKey;
  label: string;
  // The CSS variable next/font sets for it (null: the site's own font, already loaded).
  cssVar: string | null;
  // Text size multiplier, for faces that run wide or small.
  scale: number;
}

export const FONTS: readonly FontInfo[] = [
  { key: "default", label: "Freetip", cssVar: null, scale: 1 },
  { key: "poppins", label: "Poppins", cssVar: "--font-ov-poppins", scale: 1 },
  { key: "bangers", label: "Bangers", cssVar: "--font-ov-bangers", scale: 1.15 },
  { key: "pixel", label: "Pixel", cssVar: "--font-ov-pixel", scale: 0.7 },
  { key: "serif", label: "Playfair", cssVar: "--font-ov-playfair", scale: 1 },
];

const THEME_KEYS = new Set<string>(THEMES.map((t) => t.key));
const FONT_KEYS = new Set<string>(FONTS.map((f) => f.key));

export function isThemeKey(raw: unknown): raw is ThemeKey {
  return typeof raw === "string" && THEME_KEYS.has(raw);
}

export function isFontKey(raw: unknown): raw is FontKey {
  return typeof raw === "string" && FONT_KEYS.has(raw);
}

// An unknown or missing key is the default look.
export function safeTheme(raw: unknown): ThemeKey {
  return isThemeKey(raw) ? raw : DEFAULT_THEME;
}

export function safeFont(raw: unknown): FontKey {
  return isFontKey(raw) ? raw : DEFAULT_FONT;
}

// The style an alert should carry: null for the plain card (feature off, or both
// choices are the defaults), so an unthemed alert is byte-for-byte the plain one.
export function resolveOverlayStyle(raw: { theme?: unknown; font?: unknown } | null | undefined): OverlayStyle | null {
  const theme = safeTheme(raw?.theme);
  const font = safeFont(raw?.font);
  return theme === DEFAULT_THEME && font === DEFAULT_FONT ? null : { theme, font };
}

// The CSS variables for the card. Safe on anything: an unknown key gives the default.
export function overlayStyleVars(style: { theme?: unknown; font?: unknown } | null | undefined): Record<string, string> {
  const theme = THEMES.find((t) => t.key === safeTheme(style?.theme))!;
  const font = FONTS.find((f) => f.key === safeFont(style?.font))!;
  const out: Record<string, string> = { ...theme.vars };
  if (font.cssVar) out["--c-font"] = `var(${font.cssVar}), var(--font-bricolage), system-ui, sans-serif`;
  if (font.scale !== 1) out["--c-fs"] = String(font.scale);
  return out;
}
