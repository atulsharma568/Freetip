"use client";

import { useRef, type ReactNode } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(SplitText, ScrollTrigger);

// A section heading whose lines come into focus one after another the first
// time it scrolls into view: a soft blur and a short rise resolving to sharp
// text. The words are in the page from the start, so search engines, screen
// readers and no-JavaScript visitors get them at once; reduced motion skips
// the effect entirely.
export function RevealHeading({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const split = SplitText.create(el, {
          type: "lines",
          autoSplit: true,
          mask: "lines",
          onSplit: (self) =>
            gsap.from(self.lines, {
              yPercent: 60,
              opacity: 0,
              filter: "blur(0.3em)",
              duration: 1.1,
              ease: "power3.out",
              stagger: 0.12,
              scrollTrigger: { trigger: el, start: "top 85%", once: true },
            }),
        });
        return () => split.revert();
      });
      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <h2 ref={ref} className={className}>
      {children}
    </h2>
  );
}
