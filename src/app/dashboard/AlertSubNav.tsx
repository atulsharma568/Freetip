import { getSessionFeatures } from "@/lib/creator-features";
import { SlidingNav } from "./parts/SlidingNav";

// The two alert-design groups in the dashboard menu. "Look" holds Style and Layout, "Words and
// motion" holds Text and Motion; each tab is still its own page with its own switch, so a creator
// who has only one of the two switched on sees no tabs.
export const ALERT_GROUPS = {
  look: [
    { key: "style", href: "/dashboard/style", label: "Style", feature: "overlayThemes" },
    { key: "layout", href: "/dashboard/layout", label: "Layout", feature: "alertLayout" },
  ],
  words: [
    { key: "text", href: "/dashboard/text", label: "Text", feature: "alertText" },
    { key: "motion", href: "/dashboard/motion", label: "Motion", feature: "alertMotion" },
  ],
} as const;

export type AlertPage = "style" | "layout" | "text" | "motion";

export function alertGroupOf(page: AlertPage): "look" | "words" {
  return page === "style" || page === "layout" ? "look" : "words";
}

// The second row under the dashboard menu, shown on the four alert-design pages.
export async function AlertSubNav({ current }: { current: AlertPage }) {
  const features = await getSessionFeatures();
  const tabs = ALERT_GROUPS[alertGroupOf(current)].filter((t) => features[t.feature]);
  if (tabs.length < 2) return null;
  return <SlidingNav items={tabs.map(({ key, href, label }) => ({ key, href, label }))} current={current} label="Alert design" kind="location" />;
}
