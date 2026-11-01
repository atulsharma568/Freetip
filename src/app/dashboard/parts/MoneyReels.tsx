"use client";

import { useRef, type CSSProperties } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { reelTarget, spinReels } from "@/components/ui/Odometer";

// A formatted amount ("₹1,234.50") drawn on odometer reels for its digits and
// plain text for everything else. It renders at rest on the right number, then
// spins one full turn onto it the first time it is in view (the pattern in
// sections/Money.tsx). Reduced motion leaves it at rest. Decorative: put the
// amount in text for screen readers beside it.
export function MoneyReels({ text, className = "" }: { text: string; className?: string }) {
  const root = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const reels = gsap.utils.toArray<HTMLElement>("[data-reel]", root.current);
        if (!reels.length || !root.current) return;
        const tl = gsap.timeline({
          paused: true,
          scrollTrigger: { trigger: root.current, start: "top 94%", once: true },
        });
        // Hidden until it spins, so it never sits on a wrong number.
        gsap.set(root.current, { opacity: 0 });
        tl.to(root.current, { opacity: 1, duration: 0.2, ease: "none" }, 0.15);
        spinReels(gsap, reels).forEach((spin) => tl.add(spin, 0.15));
      });
    },
    { scope: root, dependencies: [text] },
  );

  return (
    <span ref={root} aria-hidden="true" className={`numeric inline-flex leading-none ${className}`}>
      {[...text].map((char, i) =>
        /\d/.test(char) ? (
          <span key={i} className="inline-block h-[1em] overflow-hidden">
            <span
              data-reel
              data-digit={char}
              className="block [translate:0_var(--reel)]"
              style={{ "--reel": `${reelTarget(Number(char))}%` } as CSSProperties}
            >
              {Array.from({ length: 20 }, (_, k) => (
                <span key={k} className="block h-[1em]">
                  {k % 10}
                </span>
              ))}
            </span>
          </span>
        ) : (
          <span key={i} className="inline-block h-[1em]">
            {char}
          </span>
        ),
      )}
    </span>
  );
}
