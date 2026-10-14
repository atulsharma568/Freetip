"use client";

import { useRef, type CSSProperties } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

const TICKS = 36;

// The tip card's "sending" screen: a dark signal panel that counts to 100%
// while a row of lime ticks switches on, then reads "Tip sent". Scanlines and
// grain sit over it (see `.uplink` in globals.css). Shown only with motion
// allowed; the card skips it under reduced motion.
export function UplinkPanel({ amount, duration }: { amount: number; duration: number }) {
  const root = useRef<HTMLDivElement>(null);
  const percent = useRef<HTMLSpanElement>(null);
  // Ticks fill the first 85% of the time; the status flips once they're done.
  const step = (duration * 0.85) / TICKS;
  const flip = duration * 0.88;

  useGSAP(
    () => {
      const count = { v: 0 };
      gsap.fromTo(
        root.current,
        { clipPath: "inset(50% 0 50% 0)" },
        { clipPath: "inset(0% 0 0% 0)", duration: 0.28, ease: "expo.out" },
      );
      gsap.to(count, {
        v: 100,
        duration: duration * 0.85,
        ease: "steps(20)",
        onUpdate: () => {
          if (percent.current) percent.current.textContent = String(Math.round(count.v));
        },
      });
    },
    { scope: root },
  );

  const corner = "absolute size-3 border-accent";

  return (
    <div
      ref={root}
      aria-hidden="true"
      className="uplink absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 overflow-hidden bg-ground/[0.97] p-8 font-mono text-accent"
    >
      <span className={`${corner} left-4 top-4 border-l border-t`} />
      <span className={`${corner} right-4 top-4 border-r border-t`} />
      <span className={`${corner} bottom-4 left-4 border-b border-l`} />
      <span className={`${corner} bottom-4 right-4 border-b border-r`} />
      <span className="absolute inset-y-10 left-4 w-px bg-accent/20" />
      <span className="absolute inset-y-10 right-4 w-px bg-accent/20" />

      <p className="text-xs tracking-[0.3em] text-muted">SECURE CHANNEL</p>
      <p className="uplink-glow numeric text-6xl font-semibold leading-none">
        <span ref={percent}>0</span>
        <span className="text-3xl">%</span>
      </p>
      <p className="text-sm tracking-[0.2em]">SENDING ₹{amount}</p>
      <div
        className="uplink-ticks flex h-7 items-end gap-[3px]"
        style={{ "--tick-step": `${step}s` } as CSSProperties}
      >
        {Array.from({ length: TICKS }, (_, i) => (
          <span key={i} style={{ "--i": i } as CSSProperties} />
        ))}
      </div>
      <p
        className="grid justify-items-center whitespace-nowrap text-xs tracking-[0.3em]"
        style={{ "--at": `${flip}s` } as CSSProperties}
      >
        <span className="uplink-swap-out text-muted [grid-area:1/1]">SECURING UPLINK</span>
        <span className="uplink-swap uplink-glow [grid-area:1/1]">TIP SENT</span>
      </p>
    </div>
  );
}
