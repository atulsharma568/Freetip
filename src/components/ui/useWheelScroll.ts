"use client";

import { useEffect, type RefObject } from "react";

// Lets a mouse wheel (or a touchpad scrolled up and down) move a row that scrolls
// sideways. Without it only a touchpad's sideways swipe or a drag works, and a drag with
// a mouse selects text. At either end of the row the wheel is left alone, so the page
// itself keeps scrolling. A sideways swipe and a pinch-zoom pass through untouched.
export function useWheelScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const next = Math.min(max, Math.max(0, el.scrollLeft + delta));
      if (next === el.scrollLeft) return;
      e.preventDefault();
      el.scrollLeft = next;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ref]);
}
