import { getSessionFeatures } from "@/lib/creator-features";
import { SlidingNav } from "./parts/SlidingNav";

const LINKS = [
  { key: "overview", href: "/dashboard", label: "Overview" },
  { key: "tips", href: "/dashboard/tips", label: "Tips" },
  { key: "recap", href: "/dashboard/recap", label: "Recap" },
  { key: "sounds", href: "/dashboard/sounds", label: "Sounds" },
  { key: "media", href: "/dashboard/media", label: "Media" },
  { key: "rules", href: "/dashboard/rules", label: "Tip page picks" },
  { key: "variations", href: "/dashboard/variations", label: "Automatic tiers" },
  { key: "look", href: "/dashboard/style", label: "Look" },
  { key: "words", href: "/dashboard/text", label: "Words and motion" },
  { key: "banner", href: "/dashboard/banner", label: "Banner" },
  { key: "pinned", href: "/dashboard/pinned", label: "Pinned" },
  { key: "fans", href: "/dashboard/fans", label: "Fans" },
  { key: "timestamps", href: "/dashboard/timestamps", label: "Timestamps" },
  { key: "streamlabs", href: "/dashboard/streamlabs", label: "Streamlabs" },
  { key: "plans", href: "/dashboard/plans", label: "Paid features" },
] as const;

// Section links shared by the dashboard pages. Alerts and settings stay on the
// overview page, below the numbers. Timestamps, Media, Rules, Look, Words and motion and Fans show only for creators they are
// switched on for.
export async function DashboardNav({ current }: { current: "overview" | "tips" | "recap" | "sounds" | "media" | "rules" | "variations" | "style" | "text" | "motion" | "layout" | "banner" | "pinned" | "fans" | "timestamps" | "streamlabs" | "plans" }) {
  const features = await getSessionFeatures();
  const links = LINKS.filter(
    (l) => (l.key !== "timestamps" || features.timestamps) && (l.key !== "media" || features.customAlertMedia) &&
      (l.key !== "rules" || features.alertRules) && (l.key !== "variations" || features.alertVariations) && (l.key !== "look" || features.overlayThemes || features.alertLayout) && (l.key !== "words" || features.alertText || features.alertMotion) && (l.key !== "banner" || features.tipBanner) && (l.key !== "pinned" || features.highlightedMessages) &&
      (l.key !== "fans" || features.fanLevels || features.fanCrm) && (l.key !== "streamlabs" || features.streamlabs),
  );
  // Each group's link opens its first page that is switched on.
  const items = links.map((l) => ({
    ...l,
    href: l.key === "look" && !features.overlayThemes ? "/dashboard/layout" : l.key === "words" && !features.alertText ? "/dashboard/motion" : l.href,
  }));
  const group = current === "style" || current === "layout" ? "look" : current === "text" || current === "motion" ? "words" : current;
  return <SlidingNav items={items} current={group} label="Dashboard" />;
}
