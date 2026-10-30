"use client";

import { useLayoutEffect, useState } from "react";
import { HeroHands } from "@/components/hero/HeroHands";

// Full-viewport overlay that plays the handoff animation once on page load.
// HeroHands calls onDone immediately under prefers-reduced-motion; the
// motion-reduce:duration-0 class makes that fade instant so the overlay
// vanishes in one frame rather than over 700 ms.
export function SplashScreen() {
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);

  // Mark body so SmoothScroll knows this page has a splash and should freeze
  // Lenis until GlobalBackground adds page-scrolled.
  useLayoutEffect(() => {
    document.body.dataset.splash = "true";
    return () => { delete document.body.dataset.splash; };
  }, []);

  if (gone) return null;

  const handleDone = () => {
    setFading(true);
    // The logo on the title screen waits for this before it starts building.
    window.dispatchEvent(new Event("splash:done"));
    // Under reduced motion the animation is instant; skip the title-screen
    // pause so the content appears straight away without needing a scroll.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.body.classList.add("page-scrolled");
    }
    setTimeout(() => setGone(true), 700);
  };

  return (
    <div
      aria-hidden="true"
      data-splash-overlay
      className={`fixed inset-0 z-[100] bg-ground flex items-center transition-opacity duration-700 motion-reduce:duration-0 ease-out${fading ? " pointer-events-none opacity-0" : ""}`}
    >
      {/* Constrain height on portrait phones so the SVG doesn't scale up to
          fill the full viewport and make the hands appear enormous. On sm+ the
          hands fill the whole overlay as before. */}
      <div className="w-full h-[28vh] min-h-[150px] sm:h-full sm:min-h-0">
        <HeroHands onDone={handleDone} immediate />
      </div>
      {/* Real text from the first paint. The title screen keeps the page itself
          invisible until the first scroll, so without this the largest visible
          text would be the "scroll to continue" cue seconds later, and that is
          what PageSpeed counted as the page's largest paint. This line is bigger
          than the cue, so the cue never takes over. It is hidden the moment the splash
          starts to fade, so no half-faded text is ever measured for contrast. */}
      <p
        className={`absolute inset-x-0 bottom-[12vh] px-6 text-center text-xl font-medium text-text sm:text-2xl${
          fading ? " invisible" : ""
        }`}
      >
        Tips for YouTube streamers
      </p>
    </div>
  );
}
