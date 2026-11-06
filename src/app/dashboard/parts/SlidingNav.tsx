"use client";

import { SpotlightNavbar, type NavItem, type SpotlightTone } from "@/components/vui/spotlight-navbar";

export type { NavItem };

// The dashboard's rows of links. Same props as before; drawn by the spotlight navbar
// (a light under the current link, a soft spotlight that follows the pointer).
// `tone` gives each section its own light: lime for the everyday row, white for the rest.
export function SlidingNav({
  items,
  current,
  label,
  kind = "page",
  tone = "accent",
}: {
  items: NavItem[];
  current: string;
  label: string;
  kind?: "page" | "location";
  tone?: SpotlightTone;
}) {
  return <SpotlightNavbar items={items} current={current} label={label} kind={kind} tone={tone} />;
}
