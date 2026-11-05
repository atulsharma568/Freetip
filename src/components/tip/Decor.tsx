"use client";

import Image from "next/image";
import { EMBER_COUNT, PETAL_COUNT, SPARK_COUNT, steady, type BannerFx, type FrameStyle } from "@/lib/page-doc/decor";
import { useMotionAllowed } from "./blocks/use-motion";

// What the header block hands down to draw: a ready-made look, or a picture or GIF of the page's
// library (`posterUrl` is the still of a GIF). Null draws nothing.
export type DecorRender =
  | { kind: "preset"; style: Exclude<FrameStyle, "none" | "custom"> | Exclude<BannerFx, "none" | "custom"> }
  // `scale` (frames only) is the size as a percent of the photo; left out it is the standard size.
  | { kind: "custom"; url: string; posterUrl: string | null; animated: boolean; scale?: number }
  | null;

// A GIF shows its still until the device may play motion (the same rule the banner and backdrop use).
function CustomPicture({ render, className }: { render: Extract<DecorRender, { kind: "custom" }>; className: string }) {
  const motion = useMotionAllowed();
  const src = render.animated && !motion ? (render.posterUrl ?? render.url) : render.url;
  // Uploads go out as they are: the image optimiser would flatten a GIF and cost a transform per size.
  return <Image src={src} alt="" fill unoptimized sizes="200px" className={className} />;
}

// The heart-monitor trace of the Clutch pulse banner: flat, two small bumps, then one tall spike.
const ECG_PATH = "M0 78 H70 l8 -7 l8 7 H128 l6 5 l10 -52 l10 66 l9 -34 l6 15 H236 l10 -9 l10 9 H400";

// The fox-fire wisps: little flames that crawl back and forth along the top of the photo, only the
// part above the middle (a swing of at most 75 degrees each way from straight up). Angles are from
// straight up, positive to the right; each has its own speed so they never line up.
const FOX_WISPS = [
  { from: -68, to: 24, secs: 5.2, delay: -1.2, size: 1 },
  { from: -22, to: 70, secs: 6.6, delay: -3.9, size: 0.8 },
  { from: -46, to: 52, secs: 8.4, delay: -6.1, size: 0.62 },
];

// The ring over a creator's photo. It is drawn bigger than the photo (like a Discord decoration) and
// never takes a click. Decoration only: the photo's own description is what a screen reader reads.
export function PhotoFrame({ render }: { render: DecorRender }) {
  if (!render) return null;
  if (render.kind === "custom") {
    return (
      <span
        aria-hidden="true"
        className="pf pf-custom"
        style={render.scale === undefined ? undefined : ({ "--pf-inset": `${(-(render.scale - 100) / 2).toFixed(1)}%` } as React.CSSProperties)}
      >
        <CustomPicture render={render} className="object-contain" />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={`pf pf-${render.style}`}>
      {render.style === "foxfire" &&
        FOX_WISPS.map((w, i) => (
          <span key={i} className="pf-fox" style={{ "--a0": `${w.from}deg`, "--a1": `${w.to}deg`, "--t": `${w.secs}s`, "--d": `${w.delay}s`, "--k": w.size } as React.CSSProperties}>
            <span className="pf-wisp" />
          </span>
        ))}
      {render.style === "aura" &&
        Array.from({ length: SPARK_COUNT }, (_, i) => (
          <span
            key={i}
            className="pf-spark"
            style={{ "--x": `${12 + steady(i, 1) * 76}%`, "--d": `${(steady(i, 2) * 2.4).toFixed(2)}s`, "--s": `${3 + Math.round(steady(i, 3) * 3)}px` } as React.CSSProperties}
          />
        ))}
    </span>
  );
}

// The effect layer over a banner. It sits inside the banner's own box, so it is cut to its shape.
export function BannerEffect({ render }: { render: DecorRender }) {
  if (!render) return null;
  if (render.kind === "custom") {
    return (
      <span aria-hidden="true" className="bfx pointer-events-none absolute inset-0">
        <CustomPicture render={render} className="object-cover" />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={`bfx bfx-${render.style}`}>
      {render.style === "embers" &&
        Array.from({ length: EMBER_COUNT }, (_, i) => (
          <span
            key={i}
            className="bfx-ember"
            style={
              {
                "--x": `${(steady(i, 4) * 100).toFixed(1)}%`,
                "--s": `${2 + Math.round(steady(i, 5) * 3)}px`,
                "--t": `${(4.5 + steady(i, 6) * 4).toFixed(1)}s`,
                "--d": `${(-steady(i, 7) * 8).toFixed(1)}s`,
                "--w": `${Math.round((steady(i, 8) - 0.5) * 36)}px`,
              } as React.CSSProperties
            }
          />
        ))}
      {render.style === "clutch" && (
        <>
          {/* A heart-monitor line that spikes, and a crosshair that locks on at the spike. The line is
              drawn in a stretched box with a stroke that keeps its width, so it fits any banner. */}
          <svg className="bfx-ecg" viewBox="0 0 400 125" preserveAspectRatio="none" focusable="false">
            <path className="bfx-ecg-trail" pathLength="1" vectorEffect="non-scaling-stroke" d={ECG_PATH} />
            <path className="bfx-ecg-head" pathLength="1" vectorEffect="non-scaling-stroke" d={ECG_PATH} />
          </svg>
          <span className="bfx-flash" />
          <svg className="bfx-aim" viewBox="0 0 44 44" focusable="false">
            <circle className="bfx-ping" cx="22" cy="22" r="10" />
            <circle cx="22" cy="22" r="11" fill="none" strokeWidth="1.6" />
            <path d="M22 3v9M22 32v9M3 22h9M32 22h9" strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="22" cy="22" r="1.8" className="bfx-aim-dot" />
          </svg>
        </>
      )}
      {render.style === "spider" && (
        <>
          {/* A web in the corner, a spider that scuttles along the bottom edge and another that drops
              down a thread now and then. All drawn here, nothing loaded. */}
          <svg className="bfx-web" viewBox="0 0 80 80" focusable="false">
            <path d="M0 0L80 0M0 0L80 30M0 0L66 66M0 0L30 80M0 0L0 80" />
            <path d="M22 0Q20 18 0 22M44 0Q40 36 0 44M66 0Q60 54 0 66" />
          </svg>
          <span className="bfx-crawler">
            <SpiderShape />
          </span>
          <span className="bfx-dropper">
            <span className="bfx-thread" />
            <SpiderShape />
          </span>
        </>
      )}
      {render.style === "storm" && (
        <>
          <span className="bfx-fog bfx-fog-a" />
          <span className="bfx-fog bfx-fog-b" />
          <span className="bfx-lightning" />
          <svg className="bfx-bolt" viewBox="0 0 40 100" preserveAspectRatio="none" focusable="false">
            <path d="M24 0L10 44H20L8 100L34 36H23L32 0Z" />
          </svg>
        </>
      )}
      {render.style === "glitch" && (
        <>
          <span className="bfx-scan" />
          <span className="bfx-beam" />
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="bfx-gbar"
              style={
                {
                  "--y": `${Math.round(18 + steady(i, 9) * 60)}%`,
                  "--h": `${6 + Math.round(steady(i, 10) * 10)}%`,
                  "--d": `${(-i * 1.7).toFixed(1)}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </>
      )}
      {render.style === "petals" &&
        Array.from({ length: PETAL_COUNT }, (_, i) => (
          <span
            key={i}
            className="bfx-petal"
            style={
              {
                "--x": `${(steady(i, 11) * 100).toFixed(1)}%`,
                "--s": `${6 + Math.round(steady(i, 12) * 6)}px`,
                "--t": `${(7 + steady(i, 13) * 6).toFixed(1)}s`,
                "--d": `${(-steady(i, 14) * 12).toFixed(1)}s`,
                "--w": `${Math.round((steady(i, 15) - 0.5) * 70)}px`,
                "--r": `${Math.round(steady(i, 16) * 360)}deg`,
              } as React.CSSProperties
            }
          />
        ))}
      {render.style === "slashes" && (
        <>
          <span className="bfx-slash" style={{ "--d": "0s" } as React.CSSProperties} />
          <span className="bfx-slash" style={{ "--d": "-2.3s", "--k": "0.6" } as React.CSSProperties} />
          <span className="bfx-slash" style={{ "--d": "-4.6s", "--k": "0.8" } as React.CSSProperties} />
        </>
      )}
    </span>
  );
}

// A small spider seen from above: body, head, eight legs that take turns. Dark, with an accent glow so
// it shows on a light or a dark banner.
function SpiderShape() {
  return (
    <svg className="bfx-spider" viewBox="0 0 44 30" focusable="false">
      <g className="bfx-legs bfx-legs-a">
        <path d="M18 13L7 5L2 9M17 16L5 15L1 20M18 18L8 26L4 28M21 11L14 2L10 3" />
      </g>
      <g className="bfx-legs bfx-legs-b">
        <path d="M26 13L37 5L42 9M27 16L39 15L43 20M26 18L36 26L40 28M23 11L30 2L34 3" />
      </g>
      <ellipse cx="22" cy="18" rx="7" ry="6.5" className="bfx-sbody" />
      <circle cx="22" cy="10.5" r="4" className="bfx-sbody" />
      <circle cx="20.3" cy="9.6" r="0.9" className="bfx-seye" />
      <circle cx="23.7" cy="9.6" r="0.9" className="bfx-seye" />
    </svg>
  );
}
