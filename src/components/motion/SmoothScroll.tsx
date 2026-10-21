"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/lib/gsap";

export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({ lerp: 0.1, anchors: true });
    lenis.on("scroll", ScrollTrigger.update);

    // Freeze Lenis while the title screen is active so the first scroll
    // gesture only dismisses the background — not the page content.
    // Resumes the instant GlobalBackground adds page-scrolled to body.
    if (!document.body.classList.contains("page-scrolled")) {
      lenis.stop();
      const mo = new MutationObserver(() => {
        if (document.body.classList.contains("page-scrolled")) {
          lenis.start();
          mo.disconnect();
        }
      });
      mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }

    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  return null;
}
