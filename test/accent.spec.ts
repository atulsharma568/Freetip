import { test, expect } from "@playwright/test";
import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT,
  accentFromPixels,
  accentStyle,
  contrast,
  inkFor,
  isReadable,
  safeAccent,
} from "../src/lib/accent";

test("every preset is readable on the page and with its ink", () => {
  for (const p of ACCENT_PRESETS) {
    expect(isReadable(p.hex), p.id).toBe(true);
    expect(contrast(p.hex, inkFor(p.hex)), p.id).toBeGreaterThanOrEqual(4.5);
  }
});

test("preset ids and colours are unique and the default is the first", () => {
  expect(new Set(ACCENT_PRESETS.map((p) => p.id)).size).toBe(ACCENT_PRESETS.length);
  expect(new Set(ACCENT_PRESETS.map((p) => p.hex)).size).toBe(ACCENT_PRESETS.length);
  expect(ACCENT_PRESETS[0].hex).toBe(DEFAULT_ACCENT);
});

test("untrusted stored values fall back to the default", () => {
  for (const bad of [null, undefined, "", "red", "#fff", "#12345", "#gggggg", "#000000", "#202020", "javascript:1", "#BFE84A;x"]) {
    expect(safeAccent(bad)).toBe(DEFAULT_ACCENT);
  }
  expect(safeAccent("#7DD3FC")).toBe("#7dd3fc");
});

test("the default draws no override and a preset draws two tokens", () => {
  expect(accentStyle(null)).toBeUndefined();
  expect(accentStyle(DEFAULT_ACCENT)).toBeUndefined();
  const s = accentStyle("#7dd3fc");
  expect(s?.["--color-accent"]).toBe("#7dd3fc");
  expect(s?.["--color-ink"]).toMatch(/^#[0-9a-f]{6}$/);
});

function fill(r: number, g: number, b: number, n: number): number[] {
  return Array.from({ length: n }, () => [r, g, b]).flat();
}

test("auto colour: a red picture gives a readable reddish colour", () => {
  const out = accentFromPixels([...fill(220, 30, 40, 200), ...fill(10, 10, 10, 100)]);
  expect(out).not.toBeNull();
  expect(isReadable(out!)).toBe(true);
});

test("auto colour: a very dark red, a pure blue and a green all end up readable", () => {
  for (const rgb of [[60, 0, 0], [0, 0, 255], [0, 200, 80]] as const) {
    const out = accentFromPixels(fill(rgb[0], rgb[1], rgb[2], 300));
    if (out) expect(isReadable(out)).toBe(true);
  }
});

test("auto colour: grey, black, white and tiny pictures give nothing", () => {
  expect(accentFromPixels(fill(128, 128, 128, 300))).toBeNull();
  expect(accentFromPixels(fill(0, 0, 0, 300))).toBeNull();
  expect(accentFromPixels(fill(255, 255, 255, 300))).toBeNull();
  expect(accentFromPixels(fill(220, 30, 40, 3))).toBeNull();
  expect(accentFromPixels([])).toBeNull();
});
