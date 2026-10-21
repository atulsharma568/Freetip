"use client";

import { useState } from "react";
import { HeroHands } from "@/components/hero/HeroHands";

// Full-viewport overlay that plays the handoff animation once on page load.
// HeroHands calls onDone immediately under prefers-reduced-motion; the
// motion-reduce:duration-0 class makes that fade instant so the overlay
// vanishes in one frame rather than over 700 ms.
export function SplashScreen() {
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);

  if (gone) return null;

  const handleDone = () => {
    setFading(true);
    document.body.classList.add("splash-done");
    setTimeout(() => setGone(true), 700);
  };

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[100] bg-ground transition-opacity duration-700 motion-reduce:duration-0 ease-out${fading ? " pointer-events-none opacity-0" : ""}`}
    >
      <HeroHands onDone={handleDone} immediate />
    </div>
  );
}
