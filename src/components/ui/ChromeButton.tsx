"use client";

import type { PointerEvent, ReactNode } from "react";
import Link from "next/link";

const SIZES = {
  sm: { root: "h-11 gap-2.5 pl-4 pr-1 text-xs", knob: "size-8" },
  lg: { root: "h-14 gap-4 pl-7 pr-1.5 text-sm", knob: "size-10" },
};

// A brushed-chrome pill with a crystal knob at its end (see `.chrome-btn` in
// globals.css): the sign up / sign in button. A light streak follows the
// pointer across the metal, and the knob lights lime on hover or focus.
// Renders a link when given `href`, otherwise a button.
export function ChromeButton({
  children,
  icon,
  href,
  type = "button",
  size = "sm",
  className = "",
}: {
  children: string;
  icon: ReactNode;
  href?: string;
  type?: "button" | "submit";
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  const streak = (event: PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty(
      "--mx",
      `${((event.clientX - box.left) / box.width) * 100}%`,
    );
  };
  const classes = `chrome-btn inline-flex shrink-0 items-center justify-between rounded-full font-mono font-semibold uppercase tracking-[0.18em] ${s.root} ${className}`;
  const inner = (
    <>
      <span>{children}</span>
      <span
        aria-hidden="true"
        className={`chrome-knob grid shrink-0 place-items-center rounded-full ${s.knob}`}
      >
        {icon}
      </span>
    </>
  );

  return href ? (
    <Link href={href} onPointerMove={streak} className={classes}>
      {inner}
    </Link>
  ) : (
    <button type={type} onPointerMove={streak} className={classes}>
      {inner}
    </button>
  );
}
