"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

// What counts as "the creator changed something": an option chip, a toggle button, a
// button marked data-reveal, or a colour picker that was closed. Save buttons and the
// preview's own controls do not match, so they never move the page.
const CHANGE = 'button[role="radio"], button[aria-pressed], button[data-reveal]';

const WIDE = "(min-width: 1024px)";

// A page with a live preview and the choices that change it.
//
// On a wide screen the preview sits in a second column that follows the page, so every
// change is seen where it is made and nothing scrolls. On a phone the preview is the first
// block; tapping a choice scrolls up to it (unless it is already on screen) and a
// "Back to options" button returns to exactly where the creator was, with focus on the
// choice they tapped.
export function PreviewSplit({ preview, children }: { preview: ReactNode; children: ReactNode }) {
  const previewRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const lastPicked = useRef<HTMLElement | null>(null);
  const away = useRef(false);
  const [backTo, setBackTo] = useState<number | null>(null);

  const reveal = useCallback((from: HTMLElement) => {
    const box = previewRef.current;
    if (!box || window.matchMedia(WIDE).matches) return;
    const r = box.getBoundingClientRect();
    if (r.top >= 0 && r.bottom <= window.innerHeight) return; // already in view
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    lastPicked.current = from;
    // Keep the first position of a run of taps, so Back returns to where the run began
    // and not to the preview itself. A short hop needs no Back button.
    if (Math.abs(r.top) > 200) {
      const y = window.scrollY;
      away.current = false;
      setBackTo((prev) => prev ?? y);
    }
    box.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }, []);

  useEffect(() => {
    const el = controlsRef.current;
    if (!el) return;
    const onClick = (e: Event) => {
      const hit = (e.target as Element | null)?.closest<HTMLElement>(CHANGE);
      if (hit && el.contains(hit) && !(hit as HTMLButtonElement).disabled) reveal(hit);
    };
    const onChange = (e: Event) => {
      const t = e.target as HTMLInputElement | null;
      if (t?.type === "color") reveal(t);
    };
    el.addEventListener("click", onClick);
    el.addEventListener("change", onChange);
    return () => {
      el.removeEventListener("click", onClick);
      el.removeEventListener("change", onChange);
    };
  }, [reveal]);

  // The button goes away once the creator is back near the spot, or the screen is widened.
  useEffect(() => {
    if (backTo === null) return;
    const check = () => {
      const gap = Math.abs(window.scrollY - backTo);
      if (gap >= 200) away.current = true;
      // Only once the page has really left the spot, so the first frames of the scroll up
      // do not count as being back.
      if (window.matchMedia(WIDE).matches || (away.current && gap < 80)) setBackTo(null);
    };
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [backTo]);

  function goBack() {
    if (backTo === null) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: backTo, behavior: reduce ? "auto" : "smooth" });
    lastPicked.current?.focus({ preventScroll: true });
    setBackTo(null);
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start lg:gap-8">
        <div ref={previewRef} className="scroll-mt-20 lg:sticky lg:top-4 lg:col-start-2 lg:row-start-1">
          {preview}
        </div>
        <div ref={controlsRef} className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1">
          {children}
        </div>
      </div>
      {backTo !== null && (
        <button
          type="button"
          onClick={goBack}
          className="fixed bottom-5 right-4 z-30 inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-ink transition-[transform] duration-200 ease-out-expo active:scale-[0.97] lg:hidden"
        >
          Back to options
        </button>
      )}
    </>
  );
}
