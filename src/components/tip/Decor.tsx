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
