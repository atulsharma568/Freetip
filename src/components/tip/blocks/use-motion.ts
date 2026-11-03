"use client";

import { useEffect, useState } from "react";
import { mayPlayMotion, readMotionEnv } from "@/lib/page-doc/motion";

// Whether this device may play a GIF or video background right now. False on the server and on the
// first draw (so the served page and the first client draw agree and show the still picture), then
// true only after the page has loaded and the rules in motion.ts allow it. It follows the
// device's reduced-motion setting if that changes while the page is open.
export function useMotionAllowed(): boolean {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let loaded = document.readyState === "complete";
    const media = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    const update = () => setAllowed(loaded && mayPlayMotion(readMotionEnv(window as never)));
    const onLoad = () => {
      loaded = true;
      update();
    };
    if (loaded) update();
    else window.addEventListener("load", onLoad, { once: true });
    media?.addEventListener?.("change", update);
    return () => {
      window.removeEventListener("load", onLoad);
      media?.removeEventListener?.("change", update);
    };
  }, []);
  return allowed;
}
