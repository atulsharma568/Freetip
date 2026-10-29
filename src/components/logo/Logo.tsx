"use client";

import { useEffect, useId, useRef } from "react";
import { gsap } from "gsap";
import { SITE_NAME } from "@/lib/site";
import {
  LOGO_BANG_BODY,
  LOGO_BANG_DOT,
  LOGO_BODY,
  LOGO_COIN,
  LOGO_I_DOT,
  LOGO_SWOOSH_SPINE,
  LOGO_VIEWBOX,
} from "./logoPaths";
import {
  COIN_DOLLAR,
  COIN_RIDE_SCALE,
  COIN_RUPEE,
  LOGO_COIN_DARK,
  LOGO_COIN_EDGE,
  LOGO_COIN_LIGHT,
  LOGO_COIN_LINE,
  LOGO_COIN_MID,
  LOGO_COIN_RIM,
  LOGO_COIN_SYMBOL,
  LOGO_OLIVE,
} from "./logoStyle";

const { cx: COIN_X, cy: COIN_Y, r: R } = LOGO_COIN;
const THICKNESS = 24; // coin thickness at the largest, in logo units
const I_DOT = { x: 1341, y: 182, r: 44 };
const BANG_DOT = { x: 1756, y: 428, r: 53 };
const BANG_FOOT = { x: 1800, y: 362 };
const LETTERS_BOTTOM = 458; // letters sit above this; the swoosh below it
const VIEW_W = 1620;

type Variant = "intro" | "static";

type Props = {
  /** "intro" plays the build-up once; "static" just shows the finished logo. */
  variant?: Variant;
  /** Repeat the coin flip and dot hops now and then after the intro. */
  loop?: boolean;
  /** Flip the coin and hop the dots when the pointer enters. */
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

  // Plain effect, not useGSAP: a gsap context made here can end up nested in
  // another component's context (the splash screen's), and then gets reverted
  // when that component unmounts, in the middle of the intro.
  const introTl = useRef<gsap.core.Timeline | null>(null);
  useEffect(() => {
      const svg = root.current;
      if (!svg) return;
      const q = <T extends Element>(sel: string) => svg.querySelector(sel) as T;

      const wipe = q<SVGRectElement>("[data-wipe]");
      const stem = q<SVGRectElement>("[data-stem]");
      const sweep = q<SVGPathElement>("[data-sweep]");
      const spine = q<SVGPathElement>("[data-spine]");
      const iDot = q<SVGPathElement>("[data-idot]");
      const bangBody = q<SVGPathElement>("[data-bang]");
      const bangDot = q<SVGPathElement>("[data-bangdot]");
      const ringI = q<SVGCircleElement>("[data-ring-i]");
      const ringBang = q<SVGCircleElement>("[data-ring-bang]");
      const coin = q<SVGGElement>("[data-coin]");
      const face = q<SVGGElement>("[data-face]");
      const frontSym = q<SVGPathElement>("[data-front]");
      const backSym = q<SVGPathElement>("[data-back]");
      const edge = q<SVGRectElement>("[data-edge]");
      const hidden = q<SVGEllipseElement>("[data-hidden]");

      const S: CoinState = { x: COIN_X, y: COIN_Y, k: 1, a: 0, lift: 0, o: 1 };
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
        frontSym.style.display = dir > 0 ? "" : "none";
        backSym.style.display = dir > 0 ? "none" : "";
      };

      const run = () => {
        // ----- The flourish: one coin flip and a hop for each dot. -----
        const pulse = (ring: SVGCircleElement, at: number | string, tl: gsap.core.Timeline) => {
          const origin = ring === ringI ? I_DOT : BANG_DOT;
          tl.fromTo(
            ring,
            { scale: 1, opacity: 0.55, immediateRender: false },
            { scale: 2.1, opacity: 0, duration: 0.8, ease: "power2.out", svgOrigin: `${origin.x} ${origin.y}`, immediateRender: false },
            at,
          );
        };
        const hop = (el: Element, at: number | string, tl: gsap.core.Timeline) => {
          tl.to(el, { y: -26, duration: 0.28, ease: "power2.out" }, at).to(
            el,
            { y: 0, duration: 0.55, ease: "bounce.out" },
            ">",
          );
        };
        gsap.set([ringI, ringBang], { opacity: 0 });
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
        hop(iDot, 0.35, f);
        pulse(ringI, 0.55, f);
        hop(bangDot, 0.75, f);
        pulse(ringBang, 0.95, f);
        flourish.current = f;

        // ----- The intro. -----
        if (variant === "intro") {
          const sweepLen = 1;
          const total = spine.getTotalLength();
          const point = (p: number) => spine.getPointAtLength(total * p);
          const tl = gsap.timeline({
            paused: true,
            onComplete: () => {
              if (!loop) return;
              looping.current = true;
              f.delay(2).restart(true);
              if (pausedNow.current) f.pause();
            },
          });

          introTl.current = tl;
          gsap.set(wipe, { attr: { width: 0 } });
          gsap.set(sweep, { attr: { "stroke-dashoffset": sweepLen } });
          gsap.set(stem, { opacity: 0 });
                    gsap.set(bangBody, { opacity: 0, y: -90, rotation: -22, svgOrigin: `${BANG_FOOT.x} ${BANG_FOOT.y}` });
          gsap.set(bangDot, { scale: 0, svgOrigin: `${BANG_DOT.x} ${BANG_DOT.y}` });
          gsap.set(iDot, { svgOrigin: `${I_DOT.x} ${I_DOT.y}` });
          S.o = 0;
          S.k = COIN_RIDE_SCALE;
          const start = point(0);
          S.x = start.x;
          S.y = start.y;
          draw();

          // 1. The letters wipe in from the F to the p.
          tl.to(wipe, { attr: { width: VIEW_W }, duration: 0.8, ease: "power2.inOut" }, 0);
          tl.from(iDot, { scale: 0, duration: 0.5, ease: "back.out(2.4)" }, 0.45);

          // 2. The swoosh draws on from the F to the p with the coin riding its head.
          const ride = { p: 0 };
          tl.addLabel("swoosh", 0.6);
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
          tl.to(stem, { opacity: 1, duration: 0.2 }, "swoosh+=0.85");

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

          // 4. The exclamation mark drops in and its dot pops.
          tl.to(bangBody, { opacity: 1, y: 0, rotation: 0, duration: 0.65, ease: "back.out(1.9)" }, "swoosh+=1.45");
          tl.to(bangDot, { scale: 1, duration: 0.8, ease: "elastic.out(1, 0.45)" }, "swoosh+=1.75");
          pulse(ringBang, "swoosh+=1.8", tl);

          if (!waitForSplash) {
            tl.play();
          } else {
            const body = document.body;
            const waiting = body.dataset.splash === "true" && !body.classList.contains("page-scrolled");
            if (!waiting) {
              tl.play();
            } else {
              const go = () => tl.play();
              window.addEventListener("splash:done", go, { once: true });
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
        }
      };

      const stop = window.matchMedia("(prefers-reduced-motion: no-preference)").matches ? run() : undefined;

      const hover = () => {
        const f = flourish.current;
        if (f && !f.isActive()) f.restart();
      };
      if (interactive) svg.addEventListener("pointerenter", hover);
      return () => {
        svg.removeEventListener("pointerenter", hover);
        stop?.();
        introTl.current?.kill();
        flourish.current?.kill();
        introTl.current = null;
        flourish.current = null;
        looping.current = false;
      };
  }, [variant, loop, interactive, waitForSplash]);

  // Pause the repeating flourish when the logo is told to, or scrolled away.
  useEffect(() => {
    pausedNow.current = paused;
    const f = flourish.current;
    if (!f || !looping.current) return;
    f.paused(paused);
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
        <clipPath id={`${id}-letters`}>
          <rect data-wipe x="280" y="100" width={VIEW_W} height={LETTERS_BOTTOM - 100} />
        </clipPath>
        <clipPath id={`${id}-below`}>
          <rect x="280" y={LETTERS_BOTTOM - 6} width={VIEW_W} height="200" />
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
          <rect data-stem x="1334" y={LETTERS_BOTTOM - 6} width="389" height="180" fill="#fff" />
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
        <path d={LOGO_BODY} clipPath={`url(#${id}-letters)`} />
        <g clipPath={`url(#${id}-below)`}>
          <path d={LOGO_BODY} mask={`url(#${id}-swoosh)`} />
        </g>
        <path data-idot d={LOGO_I_DOT} clipPath={`url(#${id}-letters)`} />
      </g>

      <circle data-ring-i cx={I_DOT.x} cy={I_DOT.y} r={I_DOT.r} stroke="currentColor" strokeWidth="7" />
      <circle data-ring-bang cx={BANG_DOT.x} cy={BANG_DOT.y} r={BANG_DOT.r} stroke={LOGO_OLIVE} strokeWidth="7" />

      <g fill={LOGO_OLIVE} fillRule="evenodd">
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
