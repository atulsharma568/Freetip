"use client";

import { useEffect, useRef, useState } from "react";
import { buildSprites, drawMoney, type MoneySprites } from "@/components/money-sprites";
import { Logo } from "@/components/logo/Logo";

const LAP = 20; // seconds per orbit lap
const TILT = (-7 * Math.PI) / 180;
const ITEM_COUNT = 20;

const ITEMS = Array.from({ length: ITEM_COUNT }, (_, i) => ({
  kind: i % 3 === 1 ? ("coin" as const) : ("note" as const),
  phase: (i / ITEM_COUNT) * Math.PI * 2 + ((i * 37) % 10) / 40,
  lift: (((i * 53) % 7) - 3) * 0.015,
}));

type Item = (typeof ITEMS)[number];

// Fixed full-viewport background: orbiting ₹ notes and coins around the
// glitching wordmark. Starts at full opacity (title-screen moment after the
// splash); sinks to blurred and dimmed as soon as the user scrolls.
export function GlobalBackground() {
  const back = useRef<HTMLCanvasElement>(null);
  const front = useRef<HTMLCanvasElement>(null);
  const [sunk, setSunk] = useState(false);
  // The "scroll" cue shows once the logo has had a moment to build.
  const [cue, setCue] = useState(false);

  // Sink on first scroll intent (wheel, touch, keyboard), OR after a timeout.
  // The first gesture must ONLY dismiss the title screen — not scroll the page.
  // preventDefault() on wheel/touchmove stops the browser's native scroll;
  // SmoothScroll.tsx keeps Lenis frozen until page-scrolled lands on body.
  // Under reduced motion the SplashScreen adds page-scrolled before this runs.
  useEffect(() => {
    if (document.body.classList.contains("page-scrolled")) {
      const id = setTimeout(() => setSunk(true), 0);
      return () => clearTimeout(id);
    }

    // Once the title screen is gone, by any route (gesture or timer), the three
    // listeners must go too, or the next wheel, touch or scroll key would still
    // be swallowed.
    let dismissed = false;
    const detach = () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("pointerdown", onPointer);
    };
    const sink = () => {
      if (dismissed) return;
      dismissed = true;
      detach();
      setSunk(true);
      document.body.classList.add("page-scrolled");
    };

    const onWheel = (e: WheelEvent) => { e.preventDefault(); sink(); };
    const onTouch = (e: TouchEvent) => { e.preventDefault(); sink(); };
    const SCROLL_KEYS = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", " "]);
    // Space and the arrows mean something else on these: typing a space, moving
    // the caret, activating a button, changing a select or a radio group. Leave
    // those keys alone; the timer still ends the title screen. A custom widget
    // is caught by its role or by being put in the tab order on purpose.
    const OWN_KEYS =
      'input, textarea, select, button, summary, [contenteditable=""], [contenteditable="true"],' +
      ' [tabindex]:not([tabindex="-1"]),' +
      ' [role="button"], [role="switch"], [role="checkbox"], [role="radio"], [role="tab"],' +
      ' [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="slider"],' +
      ' [role="spinbutton"], [role="combobox"], [role="listbox"], [role="option"],' +
      ' [role="textbox"], [role="searchbox"], [role="scrollbar"], [role="treeitem"], [role="gridcell"]';
    const onKey = (e: KeyboardEvent) => {
      if (!SCROLL_KEYS.has(e.key)) return;
      if (e.target instanceof Element && e.target.closest(OWN_KEYS)) return;
      e.preventDefault();
      sink();
    };

    // Focus moving into the page while its content is still hidden (a keyboard
    // user pressing Tab) would leave them on something they cannot see, and a
    // tap or click on the title screen means "continue". Both end the title
    // screen; neither event is blocked, so the control or link still works.
    const onFocusIn = (e: FocusEvent) => {
      if (e.target instanceof Element && e.target.closest(".page-content")) sink();
    };
    const onPointer = () => sink();

    // Auto-sink so the hero is never permanently hidden. The title screen is
    // held for 5.2 s from when the splash ends (the logo builds during it);
    // the 9 s fallback covers a splash that never reports back. (If scripts
    // fail altogether, a CSS failsafe in globals.css reveals the page.)
    let autoSink: ReturnType<typeof setTimeout>;
    let cueTimer: ReturnType<typeof setTimeout>;
    const startHold = () => {
      clearTimeout(autoSink);
      autoSink = setTimeout(sink, 5200);
      clearTimeout(cueTimer);
      cueTimer = setTimeout(() => setCue(true), 1400);
    };
    if (document.body.dataset.splash === "true") {
      window.addEventListener("splash:done", startHold, { once: true });
      autoSink = setTimeout(sink, 9000);
    } else {
      startHold();
    }

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchmove", onTouch, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("pointerdown", onPointer);

    return () => {
      clearTimeout(autoSink);
      clearTimeout(cueTimer);
      window.removeEventListener("splash:done", startHold);
      detach();
    };
  }, []);

  useEffect(() => {
    const layers = [back.current, front.current];
    const ctxs = layers.map((c) => c?.getContext("2d"));
    if (!layers[0] || !layers[1] || !ctxs[0] || !ctxs[1]) return;
    const [bctx, fctx] = ctxs as CanvasRenderingContext2D[];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = window.innerWidth;
    let h = window.innerHeight;

    let sprites: MoneySprites;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      for (const c of layers as HTMLCanvasElement[]) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
        c.style.width = `${w}px`;
        c.style.height = `${h}px`;
      }
      for (const ctx of [bctx, fctx]) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sprites = buildSprites(dpr, "rgb(191 232 74 / 0.6)");
    };

    const place = (item: Item, t: number) => {
      const a = item.phase + (t / LAP) * Math.PI * 2;
      const rx = Math.min(w * 0.43, 720);
      const ry = rx * 0.27;
      const ex = Math.cos(a) * rx;
      const ey = Math.sin(a) * ry + item.lift * rx;
      const depth = Math.sin(a);
      return {
        x: w / 2 + ex * Math.cos(TILT) - ey * Math.sin(TILT),
        y: h / 2 + ex * Math.sin(TILT) + ey * Math.cos(TILT),
        depth,
        size: Math.max(18, Math.min(38, rx / 14)) * (0.7 + 0.3 * (depth + 1)),
        spin: Math.cos(a) * 0.35,
        flip: Math.cos(t * 2.4 + item.phase * 3),
      };
    };

    const draw = (time: number) => {
      const t = time / 1000;
      bctx.clearRect(0, 0, w, h);
      fctx.clearRect(0, 0, w, h);
      const placed = ITEMS.map((item) => ({ item, ...place(item, t) })).sort(
        (p, q) => p.depth - q.depth,
      );
      for (const p of placed) {
        const ctx = p.depth > 0 ? fctx : bctx;
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.65 * ((p.depth + 1) / 2);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin);
        drawMoney(ctx, sprites, p.item.kind, p.size, p.flip, p.depth > 0);
        ctx.restore();
      }
    };

    resize();
    // Draw an initial still frame offset so it doesn't match the Closer section's start position.
    draw(8000);

    window.addEventListener("resize", resize);

    if (reduce) return () => window.removeEventListener("resize", resize);

    let frame = 0;
    const loop = (time: number) => {
      draw(time);
      frame = requestAnimationFrame(loop);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
      } else {
        frame = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    frame = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[-1] overflow-hidden"
      style={{
        filter: sunk ? "blur(28px)" : "none",
        opacity: sunk ? 0.22 : 1,
        transition: "filter 600ms ease-out, opacity 600ms ease-out",
      }}
    >
      <canvas ref={back} className="absolute inset-0" />
      <div className="absolute inset-0 flex items-center justify-center">
        <Logo
          decorative
          variant="intro"
          waitForSplash
          loop
          paused={sunk}
          className="h-auto w-[min(86vw,72rem)] max-h-[60vh] select-none text-text"
        />
      </div>
      <canvas ref={front} className="absolute inset-0" />
      <p
        data-title-cue
        className={`absolute inset-x-0 bottom-8 flex flex-col items-center gap-1 text-sm font-medium text-muted transition-opacity duration-500 ${
          cue && !sunk ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="title-cue-pointer">Scroll to continue</span>
        <span className="title-cue-touch">Swipe up to continue</span>
        <svg
          className="title-cue-arrow"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m3.5 6 4.5 4.5L12.5 6" />
        </svg>
      </p>
    </div>
  );
}
