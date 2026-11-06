"use client";

import { useEffect, useState } from "react";

// The main colour of a banner picture, as a CSS colour, so an effect over the banner can be drawn in
// the banner's own colour. It looks at a tiny copy of the picture and groups the pixels into coarse
// colour buckets. The winning bucket favours a colourful one over a big patch of near-black or
// near-white, and its colour is then nudged so an effect in it can be seen on that banner (lifted on a
// dark banner, deepened on a light one). Returns null while loading, when there is no picture, or when
// the browser will not let the page read it (a picture from another site without permission); the
// effect then keeps the page accent.
const SIZE = 24;
const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

type Bucket = { n: number; r: number; g: number; b: number };

function toHsl(r: number, g: number, b: number): [number, number, number] {
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;
  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rf) h = ((gf - bf) / d) % 6;
  else if (max === gf) h = (bf - rf) / d + 2;
  else h = (rf - gf) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function dominant(img: HTMLImageElement): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, SIZE, SIZE).data;
  } catch {
    return null; // the picture is from a site that does not allow reading it
  }
  const buckets = new Map<number, Bucket>();
  let lightSum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    lightSum += (Math.max(r, g, b) + Math.min(r, g, b)) / 510;
    count += 1;
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n += 1;
    e.r += r;
    e.g += g;
    e.b += b;
    buckets.set(key, e);
  }
  if (count === 0) return null;
  const bannerLight = lightSum / count;

  let best: { score: number; h: number; s: number; l: number } | null = null;
  for (const e of buckets.values()) {
    const [h, s, l] = toHsl(e.r / e.n, e.g / e.n, e.b / e.n);
    // A colourful bucket beats a plain one of the same size; a near-black or near-white patch counts less.
    const edge = l < 0.12 ? 0.3 : l > 0.93 ? 0.6 : 1;
    const score = e.n * (0.4 + s) * edge;
    if (!best || score > best.score) best = { score, h, s, l };
  }
  if (!best) return null;

  // Keep the hue; make it readable on this banner. A grey stays a grey (no invented hue).
  const s = best.s < 0.12 ? best.s : Math.max(best.s, 0.5);
  const l = bannerLight > 0.75 ? Math.min(best.l, 0.42) : Math.min(0.78, Math.max(best.l, 0.55));
  return `hsl(${Math.round(best.h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
}

// Finds the colour of one picture (once per address, even when asked several times at once).
// A failed load is not remembered, so a dropped connection does not stick for the whole visit.
function load(url: string): Promise<string | null> {
  const pending = inflight.get(url);
  if (pending) return pending;
  const p = new Promise<string | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const color = dominant(img);
      cache.set(url, color);
      resolve(color);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  }).finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}

// Starts finding the colours ahead of time (the dashboard preview does this for the picture choices, so
// tapping one changes the effect's colour at once instead of after the picture has downloaded).
export function warmBannerTints(urls: readonly string[]): void {
  for (const url of urls) if (!cache.has(url)) void load(url);
}

export function useBannerTint(url: string | null): string | null {
  // The last colour found. It stays while the next picture loads, so switching pictures never flashes
  // the page accent in between.
  const [found, setFound] = useState<{ url: string; color: string | null } | null>(null);
  const cached = url ? cache.get(url) : undefined;
  // A colour already known is taken straight away (adjusting this component's own state while drawing).
  if (url && cached !== undefined && (found?.url !== url || found.color !== cached)) setFound({ url, color: cached });
  useEffect(() => {
    if (!url || cache.has(url)) return;
    let cancelled = false;
    void load(url).then((color) => {
      if (!cancelled) setFound({ url, color });
    });
    return () => {
      cancelled = true;
    };
  }, [url]);
  if (!url) return null;
  if (cached !== undefined) return cached;
  return found?.color ?? null;
}
