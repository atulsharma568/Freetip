"use client";

import { useEffect, useRef } from "react";

// The site name drawn in ASCII characters. It sits dim until the pointer
// passes over it, then the characters near the pointer light up in lime and
// swap to heavier glyphs. Purely decorative: hidden from assistive tech, and
// it only repaints while the pointer moves over it (no idle animation). With
// reduced motion, or on touch screens, it stays a still dim wordmark.
const GLYPHS = ".:-=+*#%@";
const CELL = 11;
const RADIUS = 110;

export function AsciiWordmark({ text }: { text: string }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = box.current;
    const cv = canvas.current;
    if (!host || !cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const css = getComputedStyle(host);
    const dim = css.getPropertyValue("--color-control").trim() || "#777";
    const lime = css.getPropertyValue("--color-accent").trim() || "#bfe84a";
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let cells: { x: number; y: number; g: number }[] = [];
    let width = 0;
    let height = 0;
    let dpr = 1;
    let pointer: { x: number; y: number } | null = null;
    let frame = 0;

    function build() {
      width = host!.clientWidth;
      height = Math.round(Math.min(width * 0.28, 260));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv!.width = width * dpr;
      cv!.height = height * dpr;
      cv!.style.height = `${height}px`;

      // Draw the word as a solid shape once, then keep a character for each
      // grid cell the shape covers.
      const mask = document.createElement("canvas");
      mask.width = width;
      mask.height = height;
      const mctx = mask.getContext("2d");
      if (!mctx) return;
      let size = height;
      mctx.font = `900 ${size}px system-ui, sans-serif`;
      size = Math.min(size, (size * width * 0.96) / mctx.measureText(text).width);
      mctx.font = `900 ${size}px system-ui, sans-serif`;
      mctx.textAlign = "center";
      mctx.textBaseline = "middle";
      mctx.fillText(text, width / 2, height / 2 + size * 0.04);
      const data = mctx.getImageData(0, 0, width, height).data;

      cells = [];
      for (let y = CELL / 2; y < height; y += CELL) {
        for (let x = CELL / 2; x < width; x += CELL) {
          const alpha = data[(Math.floor(y) * width + Math.floor(x)) * 4 + 3];
          if (alpha > 128) cells.push({ x, y, g: (cells.length * 7) % 4 });
        }
      }
      draw();
    }

    function draw() {
      frame = 0;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, width, height);
      ctx!.font = `${CELL}px ui-monospace, monospace`;
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";
      for (const c of cells) {
        let near = 0;
        if (pointer) {
          const d = Math.hypot(c.x - pointer.x, c.y - pointer.y);
          near = Math.max(0, 1 - d / RADIUS);
        }
        ctx!.globalAlpha = 0.22 + near * 0.78;
        ctx!.fillStyle = near > 0.05 ? lime : dim;
        ctx!.fillText(GLYPHS[Math.min(GLYPHS.length - 1, c.g + Math.round(near * 5))], c.x, c.y);
      }
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(draw);
    }
    function move(e: PointerEvent) {
      if (e.pointerType === "touch") return;
      const r = cv!.getBoundingClientRect();
      pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
      schedule();
    }
    function leave() {
      pointer = null;
      schedule();
    }

    build();
    const observer = new ResizeObserver(build);
    observer.observe(host);
    if (!still) {
      host.addEventListener("pointermove", move);
      host.addEventListener("pointerleave", leave);
    }
    return () => {
      observer.disconnect();
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerleave", leave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [text]);

  return (
    <div ref={box} aria-hidden="true" className="select-none">
      <canvas ref={canvas} className="block w-full" />
    </div>
  );
}
