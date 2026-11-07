"use client";

import { useRef, type ReactNode } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(SplitText, ScrollTrigger);

// A paragraph whose words light up one after another the first time it
// scrolls into view: each word rises a little and fades from dim to full.
// The dim start is 0.85, not lower: at 0.5 the muted words measured 2.9:1 in axe
// while fading in (PageSpeed flagged them), and the 4.5:1 rule applies to the
// words even when a checker looks at them before they are revealed.
// The words are in the page from the start (search engines, screen readers
// and no-JavaScript visitors get them at once); reduced motion skips the
// effect. SplitText's own aria-label is off (`aria: "none"`): ARIA does not
// allow a label on a plain paragraph, and the words stay readable in place.
export function RevealWords({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const split = SplitText.create(el, {
          type: "words",
          aria: "none",
          onSplit: (self) =>
            gsap.from(self.words, {
              opacity: 0.85,
              yPercent: 35,
              duration: 0.7,
              ease: "power3.out",
              stagger: 0.04,
              scrollTrigger: { trigger: el, start: "top 88%", once: true },
            }),
        });
        return () => split.revert();
      });
      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <p ref={ref} className={className}>
      {children}
    </p>
  );
}
