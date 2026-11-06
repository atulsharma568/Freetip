"use client";

import { useEffect, useState } from "react";

// The most common colour of a banner picture, as a CSS colour, so an effect over the banner can be
// drawn in the banner's own colour. It looks at a tiny copy of the picture, groups the pixels into
// coarse colour buckets and averages the biggest bucket (so a white banner gives white, and a photo
// gives its main colour instead of a muddy mix). Returns null while loading, when there is no
// picture, or when the browser will not let the page read it (a picture from another site without
// permission); the effect then keeps the page accent.
const SIZE = 24;
const cache = new Map<string, string | null>();

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
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n += 1;
    e.r += r;
    e.g += g;
    e.b += b;
    buckets.set(key, e);
  }
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const e of buckets.values()) if (!best || e.n > best.n) best = e;
  if (!best) return null;
  return `rgb(${Math.round(best.r / best.n)} ${Math.round(best.g / best.n)} ${Math.round(best.b / best.n)})`;
}

export function useBannerTint(url: string | null): string | null {
  // The colour found for one address; it only counts while that is still the current address.
  const [found, setFound] = useState<{ url: string; color: string | null } | null>(null);
  useEffect(() => {
    if (!url || cache.has(url)) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const color = dominant(img);
      cache.set(url, color);
      if (!cancelled) setFound({ url, color });
    };
    img.onerror = () => {
      cache.set(url, null);
      if (!cancelled) setFound({ url, color: null });
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);
  if (!url) return null;
  if (cache.has(url)) return cache.get(url) ?? null;
  return found?.url === url ? found.color : null;
}
