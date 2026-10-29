"use client";

import { useEffect, useId, useRef } from "react";
import { gsap } from "gsap";
import { SITE_NAME } from "@/lib/site";
import {
  LOGO_BANG_BODY,
  LOGO_BANG_DOT,
  LOGO_BASELINE,
  LOGO_BODY,
  LOGO_COIN,
  LOGO_I_DOT,
  LOGO_LETTER_CUTS,
  LOGO_SWOOSH_SPINE,
  LOGO_VIEWBOX,
} from "./logoPaths";
import {
  COIN_DOLLAR,
  COIN_RIDE_SCALE,
  COIN_RUPEE,
  LOGO_ACCENT,
  LOGO_COIN_DARK,
  LOGO_COIN_EDGE,
  LOGO_COIN_LIGHT,
  LOGO_COIN_LINE,
  LOGO_COIN_MID,
  LOGO_COIN_RIM,
  LOGO_COIN_SYMBOL,
} from "./logoStyle";

const { cx: COIN_X, cy: COIN_Y, r: R } = LOGO_COIN;
const THICKNESS = 24; // coin thickness at the largest, in logo units
const I_DOT = { x: 1341, y: 182, r: 44 };
const BANG_DOT = { x: 1756, y: 428, r: 53 };
const BANG_FOOT = { x: 1800, y: 362 };
const FLIGHT = { dx: BANG_DOT.x - I_DOT.x, dy: BANG_DOT.y - I_DOT.y }; // i-dot to "!" dot
const DOT_RATIO = I_DOT.r / BANG_DOT.r;
const LETTER_COUNT = LOGO_LETTER_CUTS.length - 1; // F r e e t i p
const LETTER_TOP = 100;
const LETTER_BOTTOM = 458; // the swoosh is the part of the artwork below this line
const P_BOTTOM = 640; // the p keeps its tail, so its clip runs lower
const VIEW_W = 1620;

// Browsers may report a colour in a space GSAP cannot blend (oklab, color-mix),
// so draw one pixel with it and read back plain rgb().
const toRgb = (css: string) => {
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!ctx) return css;
  ctx.canvas.width = ctx.canvas.height = 1;
  ctx.fillStyle = "#eff0ea";
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
};

// Pivot for each letter's swing: the middle of the letter, on the baseline.
const letterPivot = (i: number) => {
  const mid = i === LETTER_COUNT - 1 ? 1540 : (LOGO_LETTER_CUTS[i] + LOGO_LETTER_CUTS[i + 1]) / 2;
  return `${mid} ${LOGO_BASELINE}`;
};

type Variant = "intro" | "static";

type Props = {
  /** "intro" plays the build-up once; "static" just shows the finished logo. */
  variant?: Variant;
  /** Repeat the coin flip and dot flight now and then after the intro. */
  loop?: boolean;
  /** Flip the coin and send the dot across when the pointer enters. */
  interactive?: boolean;
  /** Stop the repeating flourish (for example while the logo is blurred away). */
  paused?: boolean;
  /** Wait for the splash screen to finish before the intro starts. */
  waitForSplash?: boolean;
  /** Hide from assistive tech when the name is already given next to it. */
  decorative?: boolean;
  className?: string;
};

type CoinState = { x: number; y: number; k: number; a: number; lift: number; o: number };

// The coin is drawn flat and turned about its vertical axis by squashing the
// face to |cos a| and drawing the rim as the gap between two faces |sin a|
// apart, which is how a thick coin looks edge-on. At a = 0 the rupee side
// faces the viewer; at a = pi the dollar side does.
export function Logo({
  variant = "static",
  loop = false,
  interactive = false,
  paused = false,
  waitForSplash = false,
  decorative = false,
  className,
}: Props) {
  const id = useId().replace(/:/g, "");

  const root = useRef<SVGSVGElement>(null);
  const flourish = useRef<gsap.core.Timeline | null>(null);
  const looping = useRef(false);
  const pausedNow = useRef(paused);
  const visible = useRef(true); // false while a looping logo is scrolled out of view
  const syncRef = useRef<() => void>(() => {});

  // Plain effect, not useGSAP: a gsap context made here can end up nested in
  // another component's context (the splash screen's), and then gets reverted
  // when that component unmounts, in the middle of the intro.
  const introTl = useRef<gsap.core.Timeline | null>(null);
  useEffect(() => {
    const svg = root.current;
    if (!svg) return;
    const q = <T extends Element>(sel: string) => svg.querySelector(sel) as T;

    const letters = Array.from(svg.querySelectorAll<SVGGElement>("[data-letter]"));
    const sweep = q<SVGPathElement>("[data-sweep]");
    const spine = q<SVGPathElement>("[data-spine]");
    const iDot = q<SVGPathElement>("[data-idot]");
    const bangBody = q<SVGPathElement>("[data-bang]");
    const bangDot = q<SVGPathElement>("[data-bangdot]");
    const ghost = q<SVGCircleElement>("[data-ghost]");
    const ringI = q<SVGCircleElement>("[data-ring-i]");
    const ringBang = q<SVGCircleElement>("[data-ring-bang]");
    const coin = q<SVGGElement>("[data-coin]");
    const face = q<SVGGElement>("[data-face]");
    const frontSym = q<SVGPathElement>("[data-front]");
    const backSym = q<SVGPathElement>("[data-back]");
    const edge = q<SVGRectElement>("[data-edge]");
    const hidden = q<SVGEllipseElement>("[data-hidden]");

    // The letters' colour, for the dot before it turns lime. Read lazily: most logos never need it.
    let inkColor = "";
    const ink = () => (inkColor ||= toRgb(getComputedStyle(svg).color));

    const S: CoinState = { x: COIN_X, y: COIN_Y, k: 1, a: 0, lift: 0, o: 1 };
    // Play the repeating flourish only while it is neither told to pause nor off screen.
    const sync = () => {
      const f = flourish.current;
      if (!f || !looping.current) return;
      f.paused(pausedNow.current || !visible.current);
    };
    syncRef.current = sync;

    let shown = 0; // which face is showing, so the display styles are only written when it changes
    const draw = () => {
      const c = Math.cos(S.a);
      const s = Math.sin(S.a);
      const sx = Math.max(Math.abs(c), 0.0001);
      const off = THICKNESS * Math.abs(s);
      const dir = c >= 0 ? 1 : -1;
      coin.setAttribute("transform", `translate(${S.x} ${S.y + S.lift}) scale(${S.k})`);
      coin.setAttribute("opacity", String(S.o));
      face.setAttribute("transform", `translate(${(dir * off) / 2} 0) scale(${sx} 1)`);
      hidden.setAttribute("cx", String((-dir * off) / 2));
      hidden.setAttribute("rx", String(R * sx));
      edge.setAttribute("x", String(-off / 2));
      edge.setAttribute("width", String(off));
      if (dir !== shown) {
        shown = dir;
        frontSym.style.display = dir > 0 ? "" : "none";
        backSym.style.display = dir > 0 ? "none" : "";
      }
    };

    const run = () => {
      gsap.set(letters, { svgOrigin: (i: number) => letterPivot(i) });
      gsap.set(iDot, { svgOrigin: `${I_DOT.x} ${I_DOT.y}` });
      gsap.set(bangDot, { svgOrigin: `${BANG_DOT.x} ${BANG_DOT.y}` });
      gsap.set(ghost, { svgOrigin: `${I_DOT.x} ${I_DOT.y}`, opacity: 0 });
      gsap.set([ringI, ringBang], { opacity: 0 });

      const pulse = (ring: SVGCircleElement, at: number | string, tl: gsap.core.Timeline) => {
        const origin = ring === ringI ? I_DOT : BANG_DOT;
        tl.fromTo(
          ring,
          { scale: 1, opacity: 0.55, immediateRender: false },
          { scale: 2.1, opacity: 0, duration: 0.8, ease: "power2.out", svgOrigin: `${origin.x} ${origin.y}`, immediateRender: false },
          at,
        );
      };

      // ----- The flourish: coin flip, a wave through the letters, and a dot sent from the i to the "!". -----
      const f = gsap.timeline({
        paused: true,
        repeat: loop ? -1 : 0,
        repeatDelay: loop ? 3.6 : 0,
      });
      const base = { a: 0 };
      f.to(base, {
        a: Math.PI * 2,
        duration: 1.15,
        ease: "power2.inOut",
        onUpdate: () => {
          S.a = base.a;
          draw();
        },
        onComplete: () => {
          base.a = 0;
          S.a = 0;
          draw();
        },
      }, 0);
      f.to(S, { lift: -34, duration: 0.5, ease: "power2.out", yoyo: true, repeat: 1, onUpdate: draw }, 0);

      // The letters ripple left to right.
      f.to(letters, { y: -10, rotation: (i: number) => (i % 2 ? 3 : -3), duration: 0.18, ease: "power2.out", stagger: 0.05 }, 0.1);
      f.to(letters, { y: 0, rotation: 0, duration: 0.8, ease: "elastic.out(1, 0.4)", stagger: 0.05 }, 0.28);

      // A copy of the i's dot leaves it, turns lime on the way and lands on the "!".
      const g = 0.65;
      f.set(ghost, { opacity: 1, x: 0, y: 0, scale: 1, fill: ink() }, g);
      f.to(iDot, { scaleY: 0.7, scaleX: 1.12, duration: 0.1, ease: "power2.out" }, g - 0.1);
      f.to(iDot, { scale: 1, duration: 0.5, ease: "elastic.out(1, 0.4)" }, g);
      f.to(ghost, { x: FLIGHT.dx, duration: 0.8, ease: "power1.inOut" }, g);
      f.to(ghost, { y: -70, duration: 0.36, ease: "power2.out" }, g);
      f.to(ghost, { y: FLIGHT.dy, duration: 0.44, ease: "power2.in" }, g + 0.36);
      f.to(ghost, { fill: LOGO_ACCENT, scale: 1 / DOT_RATIO, duration: 0.8, ease: "none" }, g);
      f.to(ghost, { opacity: 0, duration: 0.12 }, g + 0.8);
      f.to(bangDot, { scale: 1.28, duration: 0.12, ease: "power2.out" }, g + 0.8);
      f.to(bangDot, { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.4)" }, g + 0.92);
      pulse(ringI, g, f);
      pulse(ringBang, g + 0.8, f);
      flourish.current = f;

      // ----- The intro. -----
      if (variant === "intro") {
        const total = spine.getTotalLength();
        const point = (p: number) => spine.getPointAtLength(total * p);
        const tl = gsap.timeline({
          paused: true,
          onComplete: () => {
            if (!loop) return;
            looping.current = true;
            f.delay(2).restart(true);
            sync();
          },
        });
        introTl.current = tl;

        gsap.set(letters, { opacity: 0, y: 46, rotation: (i: number) => (i % 2 ? 17 : -17) });
        gsap.set(sweep, { attr: { "stroke-dashoffset": 1 } });
        gsap.set(bangBody, { opacity: 0, y: -90, rotation: -22, svgOrigin: `${BANG_FOOT.x} ${BANG_FOOT.y}` });
        gsap.set(bangDot, { opacity: 0, x: -FLIGHT.dx, y: -FLIGHT.dy, scale: DOT_RATIO, fill: ink() });
        S.o = 0;
        S.k = COIN_RIDE_SCALE;
        const start = point(0);
        S.x = start.x;
        S.y = start.y;
        draw();

        // 1. The letters come in left to right, each swinging in with a little dance.
        letters.forEach((el, i) => {
          const at = i * 0.075;
          const dir = i % 2 ? 1 : -1;
          tl.to(el, { opacity: 1, duration: 0.25, ease: "power1.out" }, at);
          tl.to(el, { y: 0, duration: 0.5, ease: "power3.out" }, at);
          tl.to(
            el,
            {
              keyframes: [
                { rotation: -dir * 11, duration: 0.28, ease: "power2.out" },
                { rotation: dir * 7, duration: 0.2, ease: "power1.inOut" },
                { rotation: -dir * 3.5, duration: 0.18, ease: "power1.inOut" },
                { rotation: 0, duration: 0.16, ease: "power1.inOut" },
              ],
            },
            at,
          );
        });
        gsap.set(iDot, { scale: 0 });
        tl.to(iDot, { scale: 1, duration: 0.5, ease: "back.out(2.4)" }, 0.5);

        // 2. The swoosh draws itself on from the F to the p, with the coin riding its head.
        const ride = { p: 0 };
        tl.addLabel("swoosh", 1.05);
        tl.to(S, { o: 1, duration: 0.15, ease: "none", onUpdate: draw }, "swoosh");
        tl.to(
          ride,
          {
            p: 1,
            duration: 1,
            ease: "power1.inOut",
            onUpdate: () => {
              sweep.setAttribute("stroke-dashoffset", String(1 - ride.p));
              const pt = point(ride.p);
              S.x = pt.x;
              S.y = pt.y;
              S.a = ride.p * Math.PI * 6;
              draw();
            },
          },
          "swoosh",
        );

        // 3. The coin leaves the line in an arc and settles in the p's bowl.
        const end = point(1);
        const arc = { u: 0 };
        tl.to(
          arc,
          {
            u: 1,
            duration: 0.7,
            ease: "power2.inOut",
            onUpdate: () => {
              S.x = end.x + (COIN_X - end.x) * arc.u;
              S.y = end.y + (COIN_Y - end.y) * arc.u - Math.sin(Math.PI * arc.u) * 120;
              S.k = COIN_RIDE_SCALE + (1 - COIN_RIDE_SCALE) * arc.u;
              S.a = Math.PI * 6 + arc.u * Math.PI * 4;
              draw();
            },
            onComplete: () => {
              S.a = 0;
              draw();
            },
          },
          "swoosh+=1",
        );

        // 4. The "!" drops in, then the dot comes over from the i, turning lime on the way.
        tl.to(bangBody, { opacity: 1, y: 0, rotation: 0, duration: 0.65, ease: "back.out(1.9)" }, "swoosh+=1.45");
        const launch = "swoosh+=1.3";
        tl.to(iDot, { scaleY: 0.7, scaleX: 1.12, duration: 0.1, ease: "power2.out" }, "swoosh+=1.2");
        tl.to(iDot, { scale: 1, duration: 0.5, ease: "elastic.out(1, 0.4)" }, launch);
        tl.set(bangDot, { opacity: 1 }, launch);
        tl.to(bangDot, { x: 0, duration: 0.95, ease: "power1.inOut" }, launch);
        tl.to(bangDot, { y: -FLIGHT.dy - 90, duration: 0.42, ease: "power2.out" }, launch);
        tl.to(bangDot, { y: 0, duration: 0.53, ease: "bounce.out" }, `${launch}+=0.42`);
        tl.to(bangDot, { scale: 1, duration: 0.95, ease: "power1.inOut" }, launch);
        tl.to(bangDot, { fill: LOGO_ACCENT, duration: 0.95, ease: "none" }, launch);
        pulse(ringBang, "swoosh+=1.95", tl);

        if (!waitForSplash) {
          tl.play();
        } else {
          const body = document.body;
          const waiting = body.dataset.splash === "true" && !body.classList.contains("page-scrolled");
          if (!waiting) {
            tl.play();
          } else {
            let started = false;
            const go = () => {
              if (started) return;
              started = true;
              window.clearTimeout(fallback);
              window.removeEventListener("splash:done", go);
              tl.play();
            };
            window.addEventListener("splash:done", go);
            const fallback = window.setTimeout(go, 9000);
            return () => {
              window.removeEventListener("splash:done", go);
              window.clearTimeout(fallback);
            };
          }
        }
      } else if (loop) {
        looping.current = true;
        f.play();
        sync();
      }
    };

    // Kill the timelines and put every animated element back to the finished logo.
    const reset = () => {
      introTl.current?.kill();
      flourish.current?.kill();
      introTl.current = null;
      flourish.current = null;
      looping.current = false;
      gsap.set([...letters, iDot, bangBody, bangDot, ghost, ringI, ringBang, sweep], { clearProps: "all" });
      Object.assign(S, { x: COIN_X, y: COIN_Y, k: 1, a: 0, lift: 0, o: 1 });
      draw();
    };

    // A plain static logo has nothing to animate.
    const animated = variant === "intro" || loop || interactive;
    const motion = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const stop = animated && motion.matches ? run() : undefined;

    // If the visitor asks for reduced motion after the page loaded, stop and show the finished logo.
    const onMotionChange = (e: MediaQueryListEvent) => {
      if (!e.matches) {
        stop?.();
        reset();
      }
    };
    motion.addEventListener("change", onMotionChange);

    const hover = () => {
      const f = flourish.current;
      if (!f || pausedNow.current || introTl.current?.isActive()) return;
      if (f.time() < f.duration() && !f.paused() && f.isActive()) return; // already playing
      f.restart();
    };
    if (interactive) svg.addEventListener("pointerenter", hover);

    // A looping logo only plays while it is on screen.
    const watcher = loop && animated && "IntersectionObserver" in window ? new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
      sync();
    }) : undefined;
    watcher?.observe(svg);

    return () => {
      svg.removeEventListener("pointerenter", hover);
      motion.removeEventListener("change", onMotionChange);
      watcher?.disconnect();
      visible.current = true;
      stop?.();
      reset();
    };
  }, [variant, loop, interactive, waitForSplash]);

  // Pause the repeating flourish when the logo is told to, or scrolled away.
  useEffect(() => {
    pausedNow.current = paused;
    syncRef.current();
  }, [paused]);

  return (
    <svg
      ref={root}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": SITE_NAME })}
      viewBox={LOGO_VIEWBOX}
      className={className}
      fill="none"
      overflow="visible"
    >
      <defs>
        {/* One clip per letter, so each can swing on its own; the p's reaches down to keep its tail. */}
        {Array.from({ length: LETTER_COUNT }, (_, i) => {
          const x = LOGO_LETTER_CUTS[i];
          const bottom = i === LETTER_COUNT - 1 ? P_BOTTOM : LETTER_BOTTOM;
          return (
            <clipPath key={i} id={`${id}-l${i}`}>
              <rect x={x} y={LETTER_TOP} width={LOGO_LETTER_CUTS[i + 1] - x} height={bottom - LETTER_TOP} />
            </clipPath>
          );
        })}
        {/* The swoosh: the artwork below the letters, up to where the p starts. */}
        <clipPath id={`${id}-below`}>
          <rect x="280" y={LETTER_BOTTOM - 4} width={LOGO_LETTER_CUTS[LETTER_COUNT - 1] - 280 + 10} height="200" />
        </clipPath>
        <mask id={`${id}-swoosh`} maskUnits="userSpaceOnUse" x="280" y="120" width={VIEW_W} height="500">
          <path
            data-sweep
            d={LOGO_SWOOSH_SPINE}
            stroke="#fff"
            strokeWidth="46"
            strokeLinecap="round"
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset="0"
          />
        </mask>
        <radialGradient id={`${id}-face`} cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor={LOGO_COIN_LIGHT} />
          <stop offset="0.55" stopColor={LOGO_COIN_MID} />
          <stop offset="1" stopColor={LOGO_COIN_DARK} />
        </radialGradient>
      </defs>

      {/* Measuring path only: the coin rides along it. */}
      <path data-spine d={LOGO_SWOOSH_SPINE} stroke="none" visibility="hidden" />

      <g fill="currentColor" fillRule="evenodd">
        {Array.from({ length: LETTER_COUNT }, (_, i) => (
          <g key={i} data-letter>
            <g clipPath={`url(#${id}-l${i})`}>
              <path d={LOGO_BODY} />
            </g>
          </g>
        ))}
        <g clipPath={`url(#${id}-below)`}>
          <path d={LOGO_BODY} mask={`url(#${id}-swoosh)`} />
        </g>
        <path data-idot d={LOGO_I_DOT} />
      </g>

      <circle data-ring-i cx={I_DOT.x} cy={I_DOT.y} r={I_DOT.r} stroke="currentColor" strokeWidth="7" opacity="0" />
      <circle data-ring-bang cx={BANG_DOT.x} cy={BANG_DOT.y} r={BANG_DOT.r} stroke={LOGO_ACCENT} strokeWidth="7" opacity="0" />
      <circle data-ghost cx={I_DOT.x} cy={I_DOT.y} r={I_DOT.r} fill="currentColor" opacity="0" />

      <g fill={LOGO_ACCENT} fillRule="evenodd">
        <path data-bang d={LOGO_BANG_BODY} />
        <path data-bangdot d={LOGO_BANG_DOT} />
      </g>

      <g data-coin transform={`translate(${COIN_X} ${COIN_Y})`}>
        <ellipse data-hidden cx="0" cy="0" rx={R} ry={R} fill={LOGO_COIN_EDGE} />
        <rect data-edge x="0" y={-R} width="0" height={R * 2} fill={LOGO_COIN_EDGE} />
        <g data-face>
          <ellipse rx={R} ry={R} fill={`url(#${id}-face)`} stroke={LOGO_COIN_LINE} strokeWidth="6" />
          <ellipse rx={R - 13} ry={R - 13} stroke={LOGO_COIN_RIM} strokeWidth="6" opacity="0.85" />
          <path
            data-front
            d={COIN_RUPEE}
            stroke={LOGO_COIN_SYMBOL}
            strokeWidth="13"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            data-back
            d={COIN_DOLLAR}
            stroke={LOGO_COIN_SYMBOL}
            strokeWidth="13"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ display: "none" }}
          />
        </g>
      </g>
    </svg>
  );
}
