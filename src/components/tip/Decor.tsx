"use client";

import Image from "next/image";
import { EMBER_COUNT, SPARK_COUNT, steady, type BannerFx, type FrameStyle } from "@/lib/page-doc/decor";
import { useMotionAllowed } from "./blocks/use-motion";

// What the header block hands down to draw: a ready-made look, or a picture or GIF of the page's
// library (`posterUrl` is the still of a GIF). Null draws nothing.
export type DecorRender =
  | { kind: "preset"; style: Exclude<FrameStyle, "none" | "custom"> | Exclude<BannerFx, "none" | "custom"> }
  | { kind: "custom"; url: string; posterUrl: string | null; animated: boolean }
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

// The ring over a creator's photo. It is drawn bigger than the photo (like a Discord decoration) and
// never takes a click. Decoration only: the photo's own description is what a screen reader reads.
export function PhotoFrame({ render }: { render: DecorRender }) {
  if (!render) return null;
  if (render.kind === "custom") {
    return (
      <span aria-hidden="true" className="pf pf-custom">
        <CustomPicture render={render} className="object-contain" />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={`pf pf-${render.style}`}>
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
