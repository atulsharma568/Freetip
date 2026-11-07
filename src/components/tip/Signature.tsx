"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { ownerFont } from "./owner-font";

// The WebGL shader is its own chunk, fetched only when the ring is first on screen.
const LiquidMetal = dynamic(() => import("@/components/vui/liquid-metal").then((m) => m.LiquidMetal), { ssr: false });

// The owner's signature layer: the pieces that make the AcePressure tip page unlike every other
// creator's page (ideas from vengenceui.com, written here in plain CSS and a little script, no new
// package). Drawn only when the page is the owner's (`signature` in TipPageData, from
// isOwnerTipPage), never from a page document, so no other creator can switch them on.
// Everything takes the page accent (crimson on the owner's page), only transform, opacity and a
// canvas ever move, and with reduced motion every piece stands still. The cursor pieces (trail,
// spotlight) only run with a mouse.

const step = (i: number) => ({ "--i": i }) as CSSProperties;

function motionOk(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function finePointer(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: fine)").matches;
}

// "Animated Rays": a fan of crimson light from the top of the screen that sways slowly, over a
// faint receding grid at the bottom. Fixed behind the page (drawn after the backdrop, so above it).
export function SignatureRays() {
  return (
    <div aria-hidden="true" className="sig-rays pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="sig-rays-source" />
      <div className="sig-rays-fan sig-rays-fan-a" />
      <div className="sig-rays-fan sig-rays-fan-b" />
      <div className="sig-rays-floor">
        <div className="sig-rays-grid" />
      </div>
    </div>
  );
}

// "ASCII Glitch Ripple": the brand name lands as a burst of random glyphs that settle into the
// letters in a left-to-right wave, and the same wave ripples through it again when the mouse comes
// over it, with a crimson slash wiping in underneath. Each letter keeps its own width (the real
// letter stays in place, invisible, while its glyph is drawn over it) so the line never jumps.
// Screen readers get the plain name; with reduced motion the name just stands.
const GLYPHS = "░▒▓█▚▞▌▐#@%&*+=<>/\\|01";
const GLITCH_MS = 520; // how long one letter stays scrambled
const STAGGER_MS = 70; // delay between neighbouring letters (the wave's speed)
const FRAME_MS = 55; // how often a scrambled letter picks a new glyph

export function FlipName({ name, as: Heading = "h1" }: { name: string; as?: "h1" | "h3" }) {
  const chars = [...name];
  const [glyphs, setGlyphs] = useState<(string | null)[]>(() => chars.map(() => null));
  const raf = useRef(0);
  const running = useRef(false);

  const ripple = (fromScrambled: boolean) => {
    if (!motionOk() || running.current) return;
    running.current = true;
    const start = performance.now();
    const n = chars.length;
    let lastFrame = -FRAME_MS;
    const tick = (now: number) => {
      const t = now - start;
      if (t - lastFrame >= FRAME_MS) {
        lastFrame = t;
        setGlyphs(
          chars.map((c, i) => {
            if (c === " ") return null;
            const from = i * STAGGER_MS;
            const scrambled = t >= from && t < from + GLITCH_MS;
            const waiting = fromScrambled && t < from; // on load, letters not yet reached are glyphs too
            return scrambled || waiting ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)] : null;
          }),
        );
      }
      if (t < (n - 1) * STAGGER_MS + GLITCH_MS + FRAME_MS) {
        raf.current = requestAnimationFrame(tick);
      } else {
        setGlyphs(chars.map(() => null));
        running.current = false;
      }
    };
    raf.current = requestAnimationFrame(tick);
  };

  // The first ripple, on load. (Server and first paint show the plain name, so nothing mismatches.)
  useEffect(() => {
    const t = setTimeout(() => ripple(true), 150);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf.current);
      running.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  // Letters are grouped per word and a word never breaks, so a long name wraps between words only.
  let i = 0;
  const words = name.split(" ").map((word) => [...word].map((char) => ({ char, i: i++ })));
  return (
    <Heading
      translate="no"
      onPointerEnter={() => ripple(false)}
      className={`${ownerFont.className} sig-name text-[clamp(2.25rem,11vw,3.75rem)] font-black italic leading-[0.95] tracking-tight text-balance lg:text-[clamp(2.5rem,3.7vw,3.75rem)]`}
    >
      <span className="sr-only">{name}</span>
      <span aria-hidden="true">
        {words.map((letters, w) => (
          <span key={w} className="inline-block whitespace-nowrap">
            {letters.map(({ char, i: n }) => (
              <span key={n} className="sig-l" style={{ "--n": n } as CSSProperties}>
                <span aria-hidden="true" className={glyphs[n] ? "sig-l-sh sig-l-hidden" : "sig-l-sh"}>
                  {char}
                </span>
                <span className={glyphs[n] ? "sig-l-in sig-l-hidden" : "sig-l-in"}>{char}</span>
                {glyphs[n] && <span className="sig-glyph">{glyphs[n]}</span>}
              </span>
            ))}
            {w < words.length - 1 && " "}
          </span>
        ))}
      </span>
      <span aria-hidden="true" className="sig-slash" />
    </Heading>
  );
}

// Whether moving pieces should be shown with a pause control: false on the server and first paint
// (so nothing mismatches) and with reduced motion, where nothing moves anyway.
function useCanMove(): boolean {
  return useSyncExternalStore(
    () => () => {},
    motionOk,
    () => false,
  );
}

// A small pause / play toggle for text that keeps moving by itself (WCAG 2.2.2). 24 px target.
function PauseButton({ paused, onToggle }: { paused: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={paused}
      aria-label="Pause moving text"
      className="grid size-6 shrink-0 place-items-center rounded-full text-muted transition-colors hover:text-text"
    >
      <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3 fill-current">
        {paused ? <path d="M3 1.5v9l7.5-4.5z" /> : <path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" />}
      </svg>
    </button>
  );
}

// "Morph Text": the tagline shows whole, then each of its parts (split on "/") in turn, each one
// sharpening out of a blur. Screen readers get the whole line once; with reduced motion the whole
// line just stays.
export function MorphText({ text, className = "" }: { text: string; className?: string }) {
  const parts = text
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  const words = parts.length > 1 ? [text, ...parts] : [text];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const canMove = useCanMove();
  useEffect(() => {
    if (words.length < 2 || !motionOk() || paused) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % words.length), 2800);
    return () => clearInterval(timer);
  }, [words.length, paused]);
  // The whole line is plain text; only while a part shows is the whole line kept for screen readers.
  // Pausing keeps whatever shows now.
  const line =
    index === 0 || !words[index] ? (
      <span className={className}>{text}</span>
    ) : (
      <span className={className}>
        <span className="sr-only">{text}</span>
        <span key={index} aria-hidden="true" className="sig-morph">
          {words[index]}
        </span>
      </span>
    );
  if (words.length < 2 || !canMove) return line;
  return (
    <>
      {line}
      <PauseButton paused={paused} onToggle={() => setPaused((p) => !p)} />
    </>
  );
}

// "Cursor Card": the form card follows the mouse with a soft crimson spotlight inside and a lit
// edge. The position goes straight into two CSS variables (no re-render). Without a mouse the
// light just rests at the top of the card.
export function SignatureCard({ className = "", style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !finePointer()) return;
    let raf = 0;
    let x = 0;
    let y = 0;
    const apply = () => {
      raf = 0;
      el.style.setProperty("--mx", `${x}px`);
      el.style.setProperty("--my", `${y}px`);
    };
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      x = e.clientX - r.left;
      y = e.clientY - r.top;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    el.addEventListener("pointermove", move);
    return () => {
      el.removeEventListener("pointermove", move);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div ref={ref} className={`sig-card ${className}`} style={style}>
      {children}
    </div>
  );
}

// "Kinetic Text Loader": the waiting label of the Tip button, its letters bouncing in a wave.
// Screen readers get the plain words.
export function KineticLoader({ text, label }: { text: string; label: string }) {
  return (
    <>
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className={`${ownerFont.className} sig-kinetic font-black uppercase italic tracking-[0.12em]`}>
        {[...text].map((char, i) => (
          <span key={i} style={step(i)}>
            {char === " " ? "\u00A0" : char}
          </span>
        ))}
      </span>
    </>
  );
}

// The shine that sweeps across the Tip button (now and then, faster on hover) while it can be
// pressed. Sits inside the button.
export function ButtonShine() {
  return <span aria-hidden="true" className="sig-shine" />;
}

// "Logo Slider": the strip under the card as an endless line of the page's own words, which
// pauses under the mouse; with reduced motion they stand still. The moving words are drawn by CSS
// (`attr(data-text)`), so they are not page text: screen readers and text search find only the
// strip's two sides (`read`), once, exactly as the plain strip had them.
export function SignatureMarquee({ items, read, blockId }: { items: string[]; read: [string, string]; blockId?: string }) {
  const words = items.map((w) => w.trim()).filter(Boolean);
  const [paused, setPaused] = useState(false);
  const canMove = useCanMove();
  if (words.length === 0) return null;
  // Each half holds the words twice, so a half is always wider than the screen and the loop
  // (moving by exactly one half) never shows a gap.
  const half = (copy: number) => (
    <div className="sig-marquee-half">
      {[0, 1].flatMap((rep) =>
        words.map((w, i) => (
          <span key={`${copy}-${rep}-${i}`} data-text={w} className={`sig-marquee-item ${rep ? "sig-marquee-rep" : ""}`} />
        )),
      )}
    </div>
  );
  return (
    <div data-block-id={blockId} className="mt-6 border-t border-line/60 pt-3">
      <p className="sr-only">
        <span>{read[0]}</span> <span>{read[1]}</span>
      </p>
      <div className="flex items-center gap-2">
        <div aria-hidden="true" data-paused={paused || undefined} className="sig-marquee min-w-0 flex-1 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-muted">
          <div className="sig-marquee-track">
            {half(0)}
            {half(1)}
          </div>
        </div>
        {canMove && <PauseButton paused={paused} onToggle={() => setPaused((p) => !p)} />}
      </div>
    </div>
  );
}

// "Pixelated Image Trail": small square embers in the page accent fall off the mouse as it moves
// and drift up as they fade. One canvas over the page that never takes a click; it only draws
// while embers are alive, keeps at most 140, and does nothing with touch, a pen or reduced motion.
export function EmberTrail() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !finePointer() || !motionOk()) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const color = getComputedStyle(canvas).getPropertyValue("--color-accent").trim() || "#ca1b19";
    const GRID = 4;
    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    type Ember = { x: number; y: number; vx: number; vy: number; size: number; age: number; life: number; hot: boolean };
    const embers: Ember[] = [];
    let raf = 0;
    let lastX = -1;
    let lastY = -1;

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (let i = embers.length - 1; i >= 0; i--) {
        const e = embers[i];
        e.age++;
        if (e.age >= e.life) {
          embers.splice(i, 1);
          continue;
        }
        e.x += e.vx;
        e.y += e.vy;
        e.vy -= 0.015;
        const left = 1 - e.age / e.life;
        const size = Math.max(2, Math.round((e.size * (0.4 + 0.6 * left)) / 2) * 2);
        ctx.globalAlpha = left;
        ctx.fillStyle = e.hot ? "#ffe2c6" : color;
        // Snapped to a 4 px grid, so the trail reads as pixels.
        ctx.fillRect(Math.round(e.x / GRID) * GRID, Math.round(e.y / GRID) * GRID, size, size);
      }
      ctx.globalAlpha = 1;
      raf = embers.length ? requestAnimationFrame(tick) : 0;
    };

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerType !== "mouse") return;
      const dx = ev.clientX - lastX;
      const dy = ev.clientY - lastY;
      if (lastX >= 0 && dx * dx + dy * dy < 64) return;
      lastX = ev.clientX;
      lastY = ev.clientY;
      if (embers.length > 140) return;
      for (let n = 0; n < 2; n++) {
        embers.push({
          x: ev.clientX + (Math.random() - 0.5) * 10,
          y: ev.clientY + (Math.random() - 0.5) * 10,
          vx: (Math.random() - 0.5) * 0.7,
          vy: -0.2 - Math.random() * 0.6,
          size: 4 + Math.floor(Math.random() * 2) * 2,
          age: 0,
          life: 32 + Math.random() * 22,
          hot: Math.random() < 0.18,
        });
      }
      if (!raf) raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, []);
  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 size-full" />;
}

// "Liquid metal" ring around the Tip button: one shader instance, in the page accent, drawn only
// while the ring is on screen and the button can be pressed, and never with reduced motion. Until
// the shader has loaded (and whenever it is not drawn) the ring is a plain accent border, so
// nothing jumps. Wraps the button; the ring is decoration (aria-hidden, no clicks).
export function LiquidRing({ active, children }: { active: boolean; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [color, setColor] = useState("#ca1b19");
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    setAllowed(motionOk());
    setColor(getComputedStyle(el).getPropertyValue("--color-accent").trim() || "#ca1b19");
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const draw = allowed && visible && active;
  return (
    <div ref={box} className="relative w-full rounded-full p-[3px]">
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-full bg-accent/50">
        {draw && <LiquidMetal colorBack={color} colorTint="#ffffff" speed={0.35} repetition={4} distortion={0.12} className="rounded-full" />}
      </span>
      <div className="relative">{children}</div>
    </div>
  );
}

// The "Custom" amount chip, after VengeanceUI's creepy button: the face is a lid pinned at its left
// edge, and when the mouse comes near (or the chip is picked) the lid tips up and two eyes underneath
// look at the cursor and blink. It sits over the real radio (`peer`), so keyboard, screen reader and
// the checked state work as for the other amounts. Pupils are moved by setting a style directly, so
// following the mouse never re-renders. With reduced motion the lid and eyes stand still.
export function CreepyChip({ label }: { label: string }) {
  const eyes = useRef<HTMLSpanElement>(null);
  const look = (x: number, y: number) => {
    const el = eyes.current;
    if (!el || !motionOk()) return;
    const r = el.getBoundingClientRect();
    const dx = x - (r.left + r.width / 2);
    const dy = y - (r.top + r.height / 2);
    const px = Math.max(-1, Math.min(1, dx / 180)) * 25;
    const py = Math.max(-1, Math.min(1, dy / 75)) * 25;
    el.style.setProperty("--px", `${px}%`);
    el.style.setProperty("--py", `${py}%`);
  };
  const reset = () => {
    eyes.current?.style.setProperty("--px", "0%");
    eyes.current?.style.setProperty("--py", "0%");
  };
  return (
    <span
      onMouseMove={(e) => look(e.clientX, e.clientY)}
      onMouseLeave={reset}
      className="group/creepy relative flex h-12 w-full cursor-pointer select-none overflow-hidden rounded-xl bg-black text-sm peer-checked:[&>span:last-child]:-rotate-[16deg] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
    >
      <span ref={eyes} aria-hidden="true" className="pointer-events-none absolute bottom-1 right-2.5 flex items-center gap-1">
        {[0, 1].map((i) => (
          <span key={i} className="creepy-eye relative block h-2.5 w-2.5 overflow-hidden rounded-full bg-white">
            <span
              className="absolute left-1/2 top-1/2 block h-1.5 w-1.5 rounded-full bg-black"
              style={{ transform: "translate(calc(-50% + var(--px, 0%)), calc(-50% + var(--py, 0%)))", transition: "transform 75ms ease-out" }}
            />
          </span>
        ))}
      </span>
      <span className="absolute inset-0 flex origin-[1.25rem_50%] items-center justify-center rounded-xl bg-accent px-4 pt-4 font-semibold text-ink shadow-[inset_0_0_0_2px_rgb(0_0_0)] transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover/creepy:-rotate-[16deg] motion-reduce:transition-none">
        {label}
      </span>
    </span>
  );
}

// A liquid-metal ring around the amount chip that is picked (owner page only). It is mounted only
// for the picked chip, so there is at most one shader here at a time, and it is not drawn with
// reduced motion. The chip itself stays solid accent on top, so its text keeps its contrast.
export function MetalPick({ on }: { on: boolean }) {
  const box = useRef<HTMLSpanElement>(null);
  const [color, setColor] = useState("#ca1b19");
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    setAllowed(motionOk());
    setColor(getComputedStyle(el).getPropertyValue("--color-accent").trim() || "#ca1b19");
  }, []);
  return (
    <span ref={box} aria-hidden="true" className="pointer-events-none absolute -inset-[5px] overflow-hidden rounded-full">
      {on && allowed && <LiquidMetal colorBack={color} colorTint="#ffffff" speed={0.35} repetition={4} distortion={0.12} className="rounded-full" />}
    </span>
  );
}
