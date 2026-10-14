"use client";

import { useEffect, useRef, type PointerEvent } from "react";

// Plasma field resolution: drawn tiny and scaled up, so it stays soft and
// costs almost nothing per frame.
const W = 28;
const H = 16;

// Ink → lime → pale lime, indexed by plasma value 0..1.
const ramp = (t: number): [number, number, number] => {
  const ink = [24, 30, 12];
  const lime = [191, 232, 74];
  const pale = [240, 255, 196];
  const [a, b, k] = t < 0.6 ? [ink, lime, t / 0.6] : [lime, pale, (t - 0.6) / 0.4];
  return [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * k) as [number, number, number];
};

// An on/off switch with a live plasma in its track. Off: the plasma sits
// dim and still. On: it glows and flows (only while visible and motion is
// allowed). The glossy thumb takes its highlight from the pointer. Label it
// with a <label htmlFor={id}>.
export function Switch({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const image = ctx.createImageData(W, H);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const draw = (time: number) => {
      const t = time / 1000;
      const glow = checked ? 1 : 0.28;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const v =
            Math.sin(x * 0.42 + t * 1.6) +
            Math.sin((y * 0.7 + t) * 1.1) +
            Math.sin((x * 0.3 + y * 0.5 - t * 1.3) * 0.9) +
            Math.sin(Math.hypot(x - W / 2, y - H / 2) * 0.55 - t * 2);
          const [r, g, b] = ramp(((v + 4) / 8) * glow);
          const i = (y * W + x) * 4;
          image.data[i] = r;
          image.data[i + 1] = g;
          image.data[i + 2] = b;
          image.data[i + 3] = 255;
        }
      }
      ctx.putImageData(image, 0, 0);
    };

    draw(0);
    if (!checked || reduce) return;

    let frame = 0;
    let visible = true;
    const loop = (time: number) => {
      draw(time);
      frame = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      cancelAnimationFrame(frame);
      if (visible) frame = requestAnimationFrame(loop);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [checked]);

  const light = (event: PointerEvent<HTMLButtonElement>) => {
    const box = thumb.current?.getBoundingClientRect();
    if (!box) return;
    const lx = Math.min(85, Math.max(15, ((event.clientX - box.left) / box.width) * 100));
    const ly = Math.min(85, Math.max(15, ((event.clientY - box.top) / box.height) * 100));
    thumb.current?.style.setProperty("--lx", `${lx}%`);
    thumb.current?.style.setProperty("--ly", `${ly}%`);
  };

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      onPointerMove={light}
      onPointerLeave={() => {
        thumb.current?.style.removeProperty("--lx");
        thumb.current?.style.removeProperty("--ly");
      }}
      className="group relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center overflow-hidden rounded-full border border-control transition-[border-color,box-shadow] duration-300 ease-out-expo hover:border-muted aria-checked:border-accent aria-checked:shadow-[0_0_14px_rgb(191_232_74/0.45)]"
    >
      <canvas
        ref={canvas}
        width={W}
        height={H}
        aria-hidden="true"
        className="absolute inset-0 size-full"
      />
      <span
        ref={thumb}
        aria-hidden="true"
        className="plasma-thumb absolute left-[3px] size-6 rounded-full transition-[translate] duration-300 ease-out-expo group-aria-checked:translate-x-6"
      />
    </button>
  );
}
