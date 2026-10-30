"use client";

import { useEffect, useRef } from "react";
import { SITE_NAME } from "@/lib/site";
import { buildSprites, drawMoney, type MoneySprites } from "@/components/money-sprites";

// Seconds per lap.
const LAP = 16;
const TILT = (-7 * Math.PI) / 180;

// Notes and coins spaced around the ring, with a little jitter so it doesn't
// read as a clock face.
const ITEMS = Array.from({ length: 14 }, (_, i) => ({
  kind: i % 3 === 1 ? ("coin" as const) : ("note" as const),
  phase: (i / 14) * Math.PI * 2 + ((i * 37) % 10) / 40,
  lift: (((i * 53) % 7) - 3) * 0.015,
}));

type Item = (typeof ITEMS)[number];

// A ring of lime ₹ notes and coins circling the wordmark: the half of the
// ring behind the name is drawn on the back canvas, the near half on the
// front one, so the money passes behind and in front of the letters. Pauses
// off screen; one still frame under reduced motion. Decorative.
export function MoneyOrbit() {
  const root = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLCanvasElement>(null);
  const front = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const box = root.current;
    const layers = [back.current, front.current];
    const ctxs = layers.map((c) => c?.getContext("2d"));
    if (!box || !layers[0] || !layers[1] || !ctxs[0] || !ctxs[1]) return;
    const [bctx, fctx] = ctxs as CanvasRenderingContext2D[];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;

    let sprites: MoneySprites;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = box.clientWidth;
      h = box.clientHeight;
      for (const c of layers as HTMLCanvasElement[]) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      for (const ctx of [bctx, fctx]) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sprites = buildSprites(dpr, "rgb(191 232 74 / 0.55)");
    };

    const place = (item: Item, t: number) => {
      const a = item.phase + (t / LAP) * Math.PI * 2;
      const rx = Math.min(w * 0.44, 600);
      const ry = rx * 0.26;
      const ex = Math.cos(a) * rx;
      const ey = Math.sin(a) * ry + item.lift * rx;
      const depth = Math.sin(a); // -1 far (top of ring), 1 near
      return {
        x: w / 2 + ex * Math.cos(TILT) - ey * Math.sin(TILT),
        y: h / 2 + ex * Math.sin(TILT) + ey * Math.cos(TILT),
        depth,
        size: Math.max(16, Math.min(34, rx / 15)) * (0.7 + 0.3 * (depth + 1)),
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
    draw(4000);
    const ro = new ResizeObserver(() => {
      resize();
      draw(performance.now());
    });
    ro.observe(box);
    if (reduce) return () => ro.disconnect();

    let frame = 0;
    const loop = (time: number) => {
      draw(time);
      frame = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(frame);
      if (entry.isIntersecting) frame = requestAnimationFrame(loop);
    });
    io.observe(box);
    return () => {
      ro.disconnect();
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={root}
      aria-hidden="true"
      className="relative grid h-[clamp(16rem,42vw,32rem)] place-items-center overflow-hidden"
    >
      <canvas ref={back} className="absolute inset-0 size-full" />
      <p
        data-text={SITE_NAME}
        className="glitch display relative select-none text-[clamp(4.5rem,18vw,15rem)] text-text"
      >
        {SITE_NAME}
      </p>
      <canvas ref={front} className="absolute inset-0 size-full" />
    </div>
  );
}
