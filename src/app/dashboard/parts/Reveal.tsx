"use client";

import { useRef, type ReactNode } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";

const HIDDEN = "inset(0% 0% 100% 0% round 1.25rem)";
const SHOWN = "inset(0% 0% 0% 0% round 1.25rem)";

// Wipes every `[data-tile]` inside it in from the top, a few at a time as each
// comes into view (the pattern in sections/Money.tsx). Without motion, or
// without JavaScript, the tiles are simply there.
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tiles = gsap.utils.toArray<HTMLElement>("[data-tile]", root.current);
        if (!tiles.length) return;
        gsap.set(tiles, { clipPath: HIDDEN });
        ScrollTrigger.batch(tiles, {
          start: "top 94%",
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, {
              clipPath: SHOWN,
              duration: 1,
              ease: "expo.out",
              stagger: 0.09,
              clearProps: "clipPath",
            }),
        });
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
