import { getSessionFeatures } from "@/lib/creator-features";
import { getSessionIsOwnerPage } from "@/lib/session-owner";
import { SlidingNav } from "./parts/SlidingNav";

const LINKS = [
  { key: "overview", href: "/dashboard", label: "Overview" },
  { key: "tips", href: "/dashboard/tips", label: "Tips" },
  { key: "earnings", href: "/dashboard/earnings", label: "Earnings" },
  { key: "recap", href: "/dashboard/recap", label: "Recap" },
  { key: "sounds", href: "/dashboard/sounds", label: "Sounds and media" },
  { key: "tippage", href: "/dashboard/rules", label: "Tip page" },
  { key: "look", href: "/dashboard/style", label: "Alert style" },
  { key: "words", href: "/dashboard/text", label: "Alert text" },
  { key: "fans", href: "/dashboard/fans", label: "Fans" },
  { key: "timestamps", href: "/dashboard/timestamps", label: "Stream timestamps" },
  { key: "streamlabs", href: "/dashboard/streamlabs", label: "Streamlabs" },
  { key: "plans", href: "/dashboard/plans", label: "Paid features" },
] as const;

// Menu entries that hold several pages. Each page keeps its own switch; a group's menu link opens
// its first page that is switched on, and a second row of tabs shows when two or more are on.
const PAGE_GROUPS = {
  sounds: [
    { key: "sounds", href: "/dashboard/sounds", label: "Sounds", feature: null },
    { key: "media", href: "/dashboard/media", label: "Media", feature: "customAlertMedia" },
    { key: "pinned", href: "/dashboard/pinned", label: "Pinned", feature: "highlightedMessages" },
  ],
  tippage: [
    { key: "rules", href: "/dashboard/rules", label: "Picks", feature: "alertRules" },
    { key: "variations", href: "/dashboard/variations", label: "Automatic tiers", feature: "alertVariations" },
    { key: "banner", href: "/dashboard/banner", label: "Banner", feature: "tipBanner" },
    // The photo frame and banner effect: the owner's own page only for now (no paid switch yet).
    { key: "decor", href: "/dashboard/effects", label: "Effects", feature: "owner" },
  ],
} as const;

type PageGroup = keyof typeof PAGE_GROUPS;
const GROUP_OF: Record<string, PageGroup> = { sounds: "sounds", media: "sounds", pinned: "sounds", rules: "tippage", variations: "tippage", banner: "tippage", decor: "tippage" };

// Section links shared by the dashboard pages. Alerts and settings stay on the
// overview page, below the numbers. Timestamps, Tip page, Alert style, Alert text and Fans show only for creators they are
// switched on for.
export async function DashboardNav({ current }: { current: "overview" | "tips" | "earnings" | "recap" | "sounds" | "media" | "rules" | "variations" | "style" | "text" | "motion" | "layout" | "banner" | "decor" | "pinned" | "fans" | "timestamps" | "streamlabs" | "plans" }) {
  const features = await getSessionFeatures();
  const ownerPage = await getSessionIsOwnerPage();
  const onTabs = (g: PageGroup) => PAGE_GROUPS[g].filter((t) => t.feature === null || (t.feature === "owner" ? ownerPage : features[t.feature]));
  const links = LINKS.filter(
    (l) => (l.key !== "timestamps" || features.timestamps) && (l.key !== "tippage" || onTabs("tippage").length > 0) &&
      (l.key !== "look" || features.overlayThemes || features.alertLayout) && (l.key !== "words" || features.alertText || features.alertMotion) &&
      (l.key !== "fans" || features.fanLevels || features.fanCrm) && (l.key !== "streamlabs" || features.streamlabs),
  );
  // Each group's link opens its first page that is switched on.
  const items = links.map((l) => ({
    ...l,
    href: l.key === "look" && !features.overlayThemes ? "/dashboard/layout" : l.key === "words" && !features.alertText ? "/dashboard/motion" : l.key === "tippage" || l.key === "sounds" ? onTabs(l.key)[0].href : l.href,
  }));
  // Three clusters: everyday pages, Earnings on its own, and the paid features switched on for this creator.
  const FEATURE_KEYS = ["tippage", "look", "words", "fans", "timestamps", "streamlabs"];
  const main = items.filter((i) => i.key !== "earnings" && !FEATURE_KEYS.includes(i.key));
  const earnings = items.filter((i) => i.key === "earnings");
  const mine = items.filter((i) => FEATURE_KEYS.includes(i.key));
  const group = current === "style" || current === "layout" ? "look" : current === "text" || current === "motion" ? "words" : (GROUP_OF[current] ?? current);
  const tabs = GROUP_OF[current] ? onTabs(GROUP_OF[current]) : [];
  return (
    <>
      <div className="flex max-w-full flex-wrap items-center gap-2">
        <SlidingNav items={main} current={group} label="Dashboard" />
        <SlidingNav items={earnings} current={group} label="Earnings" />
      </div>
      {mine.length > 0 && (
        <div className="flex max-w-full flex-wrap items-center gap-2">
          <span className="px-1 text-xs font-medium uppercase tracking-wide text-muted">Your paid features</span>
          <SlidingNav items={mine} current={group} label="Paid features switched on" />
        </div>
      )}
      {tabs.length > 1 && <SlidingNav items={tabs.map(({ key, href, label }) => ({ key, href, label }))} current={current} label={group === "sounds" ? "Sounds and media" : "Tip page"} kind="location" />}
    </>
  );
}
