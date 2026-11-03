"use client";

import { useEffect, type RefObject } from "react";

// Lets a mouse wheel (or a touchpad scrolled up and down) move a row that scrolls
// sideways. Without it only a touchpad's sideways swipe or a drag works, and a drag with
// a mouse selects text. At either end of the row the wheel is left alone, so the page
// itself keeps scrolling. A sideways touchpad swipe is handled here too, even when it
// drifts a little up or down, so the page does not scroll under it; a pinch-zoom passes
// through untouched. The row also needs data-lenis-prevent, or the smooth-scroll
// library takes the wheel before this runs.
export function useWheelScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const sideways = Math.abs(e.deltaX) * 2 >= Math.abs(e.deltaY);
      const raw = sideways ? e.deltaX : e.deltaY;
      const delta = e.deltaMode === 1 ? raw * 16 : raw;
      const next = Math.min(max, Math.max(0, el.scrollLeft + delta));
      if (next === el.scrollLeft) return;
      e.preventDefault();
      el.scrollLeft = next;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ref]);
}
