"use client";

import { useEffect, useState } from "react";
import { SlidingNav, type NavItem } from "./SlidingNav";

const ITEMS: NavItem[] = [
  { key: "today", href: "#today", label: "Today" },
  { key: "stream", href: "#stream", label: "Stream" },
  { key: "account", href: "#account", label: "Account" },
];

// The sticky row under the header that jumps between the three groups on the
// overview and shows which one is on screen. Solid ground, a Hairline under
// it: no blur, no shadow.
export function SectionRail() {
  const [current, setCurrent] = useState("today");

  useEffect(() => {
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        const first = ITEMS.find((i) => seen.get(i.key));
        if (first) setCurrent(first.key);
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );
    for (const i of ITEMS) {
      const el = document.getElementById(i.key);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  return (
    <div className="sticky top-0 z-30 border-b border-line/60 bg-ground">
      <div className="mx-auto max-w-7xl px-6 py-2">
        <SlidingNav items={ITEMS} current={current} label="Dashboard sections" kind="location" />
      </div>
    </div>
  );
}
