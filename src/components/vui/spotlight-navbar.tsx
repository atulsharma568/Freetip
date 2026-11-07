"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { animate } from "framer-motion";
import { cn } from "@/lib/utils";
import { useWheelScroll } from "@/components/ui/useWheelScroll";

export interface NavItem {
  key: string;
  href: string;
  label: string;
}

export type SpotlightTone = "accent" | "neutral";

const TONES: Record<SpotlightTone, { light: string; glow: string }> = {
  accent: { light: "var(--color-accent)", glow: "color-mix(in oklab, var(--color-accent) 24%, transparent)" },
  neutral: { light: "var(--color-text)", glow: "color-mix(in oklab, var(--color-text) 16%, transparent)" },
};

// A row of real links (next/link) in a glass pill. A light line sits under the current
// link; a soft spotlight follows the pointer and springs back to the current link when it
// leaves. The site is dark only, so there is no light theme branch. On a phone the row
// scrolls sideways. Reduced motion: the light jumps instead of springing.
// `tone` picks the light colour per section ("accent" lime, "neutral" white).
export function SpotlightNavbar({
  items,
  current,
  label,
  kind = "page",
  tone = "accent",
  className,
}: {
  items: NavItem[];
  current: string;
  label: string;
  kind?: "page" | "location";
  tone?: SpotlightTone;
  className?: string;
}) {
  const nav = useRef<HTMLElement>(null);
  const links = useRef(new Map<string, HTMLAnchorElement>());
  const spot = useRef(0);
  const ambience = useRef(0);
  // The spring now running for each CSS variable, so a new move stops it instead of fighting it.
  const running = useRef(new Map<string, { stop: () => void }>());
  const [hovering, setHovering] = useState(false);
  useWheelScroll(nav);

  const centreOf = useCallback((key: string) => {
    const el = links.current.get(key);
    return el ? el.offsetLeft + el.offsetWidth / 2 : null;
  }, []);

  const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const move = useCallback(
    (ref: { current: number }, prop: string, to: number) => {
      const n = nav.current;
      if (!n) return;
      running.current.get(prop)?.stop();
      if (reduced()) {
        ref.current = to;
        n.style.setProperty(prop, `${to}px`);
        return;
      }
      const controls = animate(ref.current, to, {
        type: "spring",
        stiffness: 200,
        damping: 20,
        onUpdate: (v) => {
          ref.current = v;
          n.style.setProperty(prop, `${v}px`);
        },
      });
      running.current.set(prop, controls);
    },
    [],
  );

  // The light under the current link follows it, and again if the row resizes.
  useEffect(() => {
    const n = nav.current;
    if (!n) return;
    const place = () => {
      const x = centreOf(current);
      if (x == null) return;
      move(ambience, "--ambience-x", x);
      if (!hovering) move(spot, "--spotlight-x", x);
    };
    place();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(place);
    ro.observe(n);
    return () => ro.disconnect();
    // `hovering` is read, not watched: the pointer handlers own the spotlight while it is over the row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, centreOf, move]);

  // Bring the current link into view when the row scrolls.
  useEffect(() => {
    const el = links.current.get(current);
    const n = nav.current;
    if (!el || !n || n.scrollWidth <= n.clientWidth) return;
    n.scrollLeft = Math.max(0, el.offsetLeft - 24);
  }, [current]);

  useEffect(() => {
    const live = running.current;
    return () => live.forEach((c) => c.stop());
  }, []);

  const { light, glow } = TONES[tone];

  return (
    <nav
      ref={nav}
      aria-label={label}
      data-lenis-prevent
      style={{ "--spot-light": light, "--spot-glow": glow } as React.CSSProperties}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - r.left + e.currentTarget.scrollLeft;
        setHovering(true);
        spot.current = x;
        e.currentTarget.style.setProperty("--spotlight-x", `${x}px`);
      }}
      onPointerLeave={() => {
        setHovering(false);
        const x = centreOf(current);
        if (x != null) move(spot, "--spotlight-x", x);
      }}
      className={cn(
        "spotlight-nav-bg glass-border spotlight-nav-shadow relative isolate max-w-full select-none overflow-x-auto rounded-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {/* The inner row is as wide as all the links, so the lights below reach every link when the
          row scrolls sideways (they used to stop at the visible width). */}
      <div className="relative flex w-max min-w-full items-center px-1">
      {/* Spotlight that follows the pointer (mouse only). */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 transition-opacity duration-300"
        style={{
          opacity: hovering ? 1 : 0,
          background: "radial-gradient(120px circle at var(--spotlight-x, 0px) 100%, var(--spot-glow) 0%, transparent 60%)",
        }}
      />
      {/* The light under the current link. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 -z-10 h-[2px] w-full"
        style={{
          background: "radial-gradient(60px circle at var(--ambience-x, 0px) 0%, var(--spot-light) 0%, transparent 100%)",
        }}
      />
      {items.map((item) => {
        const isCurrent = item.key === current;
        return (
          <Link
            key={item.key}
            ref={(el) => {
              if (el) links.current.set(item.key, el);
              else links.current.delete(item.key);
            }}
            href={item.href}
            aria-current={isCurrent ? (kind === "page" ? "page" : "location") : undefined}
            data-current={isCurrent ? "" : undefined}
            className={cn(
              "relative inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-medium transition-colors duration-200 focus-visible:outline-offset-[-3px]",
              isCurrent ? "text-text" : "text-muted hover:text-text",
            )}
          >
            {item.label}
          </Link>
        );
      })}
      </div>
    </nav>
  );
}
