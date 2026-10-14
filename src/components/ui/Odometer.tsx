import type { CSSProperties } from "react";

// A number drawn as odometer reels: an optional prefix, one reel per digit,
// an optional suffix. Each reel is two runs of 0-9 stacked in a one-digit
// window, and its [data-reel] strip sits at `translate: 0 var(--reel)`. It
// renders at rest on its digit, so the number reads correctly before any
// animation (and without JS). To spin, tween "--reel" from "0%" to
// `${reelTarget(digit)}%`: one full turn, landing on the digit. Decorative:
// give the number to screen readers separately.
export const reelTarget = (digit: number) => -((10 + digit) / 20) * 100;

export function Odometer({
  value,
  prefix = "₹",
  suffix = "",
  className = "",
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={`numeric inline-flex leading-none ${className}`}>
      {prefix && <span>{prefix}</span>}
      {[...String(value)].map((char, i) => (
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
      ))}
      {suffix && <span>{suffix}</span>}
    </span>
  );
}

// Spin every reel in `reels` a full turn onto its digit, the rightmost last.
// Returns the tweens so callers can place them on a timeline.
export function spinReels(gsapInstance: typeof import("gsap").gsap, reels: HTMLElement[]) {
  return reels.map((reel, i) =>
    gsapInstance.fromTo(
      reel,
      { "--reel": "0%" },
      {
        "--reel": `${reelTarget(Number(reel.dataset.digit))}%`,
        duration: 0.75 + i * 0.12,
        ease: "power3.out",
      },
    ),
  );
}
