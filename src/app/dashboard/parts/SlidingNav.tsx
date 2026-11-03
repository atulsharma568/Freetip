"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useWheelScroll } from "@/components/ui/useWheelScroll";

export interface NavItem {
  key: string;
  href: string;
  label: string;
}

// A segmented control of links. A solid lime pill sits behind the current one
// and slides (500ms expo) to whichever link is hovered or keyboard-focused,
// then back (the highlight the landing nav uses). On a phone it scrolls
// sideways instead of overflowing the page. Before the pill is measured, the
// current link carries its own lime, so nothing flashes.
export function SlidingNav({
  items,
  current,
  label,
  kind = "page",
}: {
  items: NavItem[];
  current: string;
  label: string;
  kind?: "page" | "location";
}) {
  const box = useRef<HTMLElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const links = useRef(new Map<string, HTMLAnchorElement>());
  const [hovered, setHovered] = useState<string | null>(null);
  const active = hovered ?? current;
  // A mouse wheel moves the row sideways (a touchpad swipe already does).
  useWheelScroll(box);

  const place = useCallback(() => {
    const el = links.current.get(active);
    const p = pill.current;
    const b = box.current;
    if (!el || !p || !b) return;
    p.style.width = `${el.offsetWidth}px`;
    p.style.transform = `translateX(${el.offsetLeft}px)`;
    p.style.opacity = "1";
    b.dataset.ready = "1";
  }, [active]);

  useEffect(() => {
    place();
    const b = box.current;
    if (!b || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(place);
    ro.observe(b);
    return () => ro.disconnect();
  }, [place]);

  // Bring the current link into view when the row scrolls.
  useEffect(() => {
    const el = links.current.get(current);
    const b = box.current;
    if (!el || !b || b.scrollWidth <= b.clientWidth) return;
    b.scrollLeft = Math.max(0, el.offsetLeft - 24);
  }, [current]);

  return (
    <nav
      ref={box}
      aria-label={label}
      data-lenis-prevent
      onPointerLeave={() => setHovered(null)}
      className="group/nav relative flex max-w-full select-none items-center gap-0.5 overflow-x-auto rounded-full border border-control p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <span
        ref={pill}
        aria-hidden="true"
        className="absolute bottom-1 left-0 top-1 w-0 rounded-full bg-accent opacity-0 transition-[transform,width] duration-500 ease-out-expo"
      />
      {items.map((item) => (
        <Link
          key={item.key}
          ref={(el) => {
            if (el) links.current.set(item.key, el);
            else links.current.delete(item.key);
          }}
          href={item.href}
          aria-current={item.key === current ? (kind === "page" ? "page" : "location") : undefined}
          data-current={item.key === current ? "" : undefined}
          onPointerEnter={() => setHovered(item.key)}
          onFocus={() => setHovered(item.key)}
          onBlur={() => setHovered(null)}
          className={`relative z-10 inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-medium transition-colors duration-300 data-[current]:bg-accent group-data-[ready]/nav:data-[current]:bg-transparent ${
            item.key === active ? "text-ink" : "text-text"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
