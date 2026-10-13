"use client";

import { useRef, type ReactNode } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

export function Magnetic({
  children,
  strength = 0.22,
  className = "",
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        "(prefers-reduced-motion: no-preference) and (hover: hover)",
        () => {
          const el = ref.current;
          if (!el) return;
          const x = gsap.quickTo(el, "x", { duration: 0.6, ease: "power3.out" });
          const y = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3.out" });

          const move = (event: PointerEvent) => {
            const rect = el.getBoundingClientRect();
            x((event.clientX - (rect.left + rect.width / 2)) * strength);
            y((event.clientY - (rect.top + rect.height / 2)) * strength);
          };
          const leave = () => {
            x(0);
            y(0);
          };

          el.addEventListener("pointermove", move);
          el.addEventListener("pointerleave", leave);
          return () => {
            el.removeEventListener("pointermove", move);
            el.removeEventListener("pointerleave", leave);
          };
        },
      );
    },
    { scope: ref },
  );

  return (
    <span ref={ref} className={`inline-block ${className}`.trim()}>
      {children}
    </span>
  );
}
