"use client";

import { useEffect, useRef, useState } from "react";
import { INK_HEX as INK, SITE_NAME } from "@/lib/site";

const LIME = "#bfe84a";
const LAP = 20; // seconds per orbit lap
const TILT = (-7 * Math.PI) / 180;
const ITEM_COUNT = 20;

const ITEMS = Array.from({ length: ITEM_COUNT }, (_, i) => ({
  kind: i % 3 === 1 ? ("coin" as const) : ("note" as const),
  phase: (i / ITEM_COUNT) * Math.PI * 2 + ((i * 37) % 10) / 40,
  lift: (((i * 53) % 7) - 3) * 0.015,
}));

type Item = (typeof ITEMS)[number];

function drawNote(ctx: CanvasRenderingContext2D, size: number) {
  const w = size * 1.9;
  const h = size;
  ctx.fillStyle = LIME;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, size * 0.14);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgb(29 36 16 / 0.45)";
  ctx.lineWidth = Math.max(1, size * 0.05);
  ctx.beginPath();
  ctx.roundRect(-w / 2 + size * 0.12, -h / 2 + size * 0.12, w - size * 0.24, h - size * 0.24, size * 0.08);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = `700 ${size * 0.56}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("₹", 0, size * 0.03);
}

function drawCoin(ctx: CanvasRenderingContext2D, size: number, flip: number) {
  const r = size * 0.55;
  ctx.scale(Math.max(0.12, Math.abs(flip)), 1);
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, "#f2ffc8");
  g.addColorStop(0.45, LIME);
  g.addColorStop(1, "#6f8f1c");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  if (Math.abs(flip) > 0.35) {
    ctx.fillStyle = INK;
    ctx.font = `700 ${r * 1.05}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("₹", 0, r * 0.05);
  }
}

// Fixed full-viewport background: orbiting ₹ notes and coins around the
// glitching wordmark. Starts at full opacity (title-screen moment after the
// splash); sinks to blurred and dimmed as soon as the user scrolls.
export function GlobalBackground() {
  const back = useRef<HTMLCanvasElement>(null);
  const front = useRef<HTMLCanvasElement>(null);
  const [sunk, setSunk] = useState(false);

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

    let dismissed = false;
    const sink = () => {
      if (dismissed) return;
      dismissed = true;
      setSunk(true);
      document.body.classList.add("page-scrolled");
    };

    const onWheel = (e: WheelEvent) => { e.preventDefault(); sink(); };
    const onTouch = (e: TouchEvent) => { e.preventDefault(); sink(); };
    const SCROLL_KEYS = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", " "]);
    const onKey = (e: KeyboardEvent) => { if (SCROLL_KEYS.has(e.key)) { e.preventDefault(); sink(); } };

    // Auto-sink after 5 s so the hero is never permanently hidden.
    const autoSink = setTimeout(sink, 5000);

    window.addEventListener("wheel", onWheel, { once: true, passive: false });
    window.addEventListener("touchmove", onTouch, { once: true, passive: false });
    window.addEventListener("keydown", onKey, { once: true });

    return () => {
      clearTimeout(autoSink);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("keydown", onKey);
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
        ctx.shadowColor = "rgb(191 232 74 / 0.6)";
        ctx.shadowBlur = p.depth > 0 ? 22 : 8;
        if (p.item.kind === "note") drawNote(ctx, p.size);
        else drawCoin(ctx, p.size, p.flip);
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
        <p
          data-text={SITE_NAME}
          className="glitch display select-none text-[clamp(5rem,_min(28vw,_45vh),_28rem)] text-text"
        >
          {SITE_NAME}
        </p>
      </div>
      <canvas ref={front} className="absolute inset-0" />
    </div>
  );
}
