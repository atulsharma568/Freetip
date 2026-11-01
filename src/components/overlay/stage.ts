"use client";

import { useEffect, useRef, useState } from "react";

// What every OBS overlay shares: one size unit, the Freetip tokens and the parent
// style the pages set. Pure CSS keyframes only (OBS's browser source cannot rely on
// Tailwind or GSAP).
//
// --u is 1% of the stage width, measured from the stage itself, so the same markup
// is right at 1920x1080, 2560x1440 and 1080x1920 (and inside a preview box) without
// viewport or container units, which older OBS browsers may not support.
export function useStageSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1920, h: 1080 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth || 1920, h: el.clientHeight || 1080 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, w: size.w, h: size.h, portrait: size.h > size.w };
}

// Shared by every overlay's own <style>: tokens from DESIGN.md (Warm Night, Raised
// Smoke, Chalk, Ash), the accent and its ink, and the two type voices. Money is mono.
export const STAGE_CSS = `
.ov-stage {
  --ov-night: #0c0d09; --ov-raised: #24251f; --ov-chalk: #eeefea; --ov-ash: #ababa4;
  --ov-lime: var(--ov-accent, #bfe84a); --ov-on-lime: var(--ov-ink, #14170a);
  position: relative; width: 100%; height: 100%; overflow: hidden;
  font-family: var(--font-bricolage), system-ui, sans-serif;
}
.ov-mono { font-family: var(--font-geist-mono), ui-monospace, monospace; font-feature-settings: 'tnum'; font-variant-numeric: tabular-nums; }
`;

// --u as above, plus --f: the unit the panels (goal bar, supporter cards) are drawn in.
// A portrait stage is narrow, so --f is 1.8 times --u there and the same panel stays
// as big on screen as it is on a landscape one.
export function stageStyle(w: number, portrait: boolean): React.CSSProperties {
  const u = w / 100;
  return { "--u": `${u}px`, "--f": `${portrait ? u * 1.8 : u}px` } as React.CSSProperties;
}
