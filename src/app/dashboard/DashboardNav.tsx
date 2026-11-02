import { getSessionFeatures } from "@/lib/creator-features";
import { SlidingNav } from "./parts/SlidingNav";

const LINKS = [
  { key: "overview", href: "/dashboard", label: "Overview" },
  { key: "tips", href: "/dashboard/tips", label: "Tips" },
  { key: "recap", href: "/dashboard/recap", label: "Recap" },
  { key: "sounds", href: "/dashboard/sounds", label: "Sounds" },
  { key: "media", href: "/dashboard/media", label: "Media" },
  { key: "rules", href: "/dashboard/rules", label: "Rules" },
  { key: "style", href: "/dashboard/style", label: "Style" },
  { key: "text", href: "/dashboard/text", label: "Text" },
  { key: "motion", href: "/dashboard/motion", label: "Motion" },
  { key: "pinned", href: "/dashboard/pinned", label: "Pinned" },
  { key: "fans", href: "/dashboard/fans", label: "Fans" },
  { key: "timestamps", href: "/dashboard/timestamps", label: "Timestamps" },
  { key: "streamlabs", href: "/dashboard/streamlabs", label: "Streamlabs" },
] as const;

// Section links shared by the dashboard pages. Alerts and settings stay on the
// overview page, below the numbers. Timestamps, Media, Rules, Style and Fans show only for creators they are
// switched on for.
export async function DashboardNav({ current }: { current: "overview" | "tips" | "recap" | "sounds" | "media" | "rules" | "style" | "text" | "motion" | "pinned" | "fans" | "timestamps" | "streamlabs" }) {
  const features = await getSessionFeatures();
  const links = LINKS.filter(
    (l) => (l.key !== "timestamps" || features.timestamps) && (l.key !== "media" || features.customAlertMedia) &&
      (l.key !== "rules" || features.alertRules) && (l.key !== "style" || features.overlayThemes) && (l.key !== "text" || features.alertText) && (l.key !== "motion" || features.alertMotion) && (l.key !== "pinned" || features.highlightedMessages) &&
      (l.key !== "fans" || features.fanLevels || features.fanCrm || features.birthdayMessage) && (l.key !== "streamlabs" || features.streamlabs),
  );
  return <SlidingNav items={links.map((l) => ({ ...l }))} current={current} label="Dashboard" />;
}
