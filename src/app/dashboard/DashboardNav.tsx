import { getSessionFeatures } from "@/lib/creator-features";
import { SlidingNav } from "./parts/SlidingNav";

const LINKS = [
  { key: "overview", href: "/dashboard", label: "Overview" },
  { key: "tips", href: "/dashboard/tips", label: "Tips" },
  { key: "sounds", href: "/dashboard/sounds", label: "Sounds" },
  { key: "media", href: "/dashboard/media", label: "Media" },
  { key: "rules", href: "/dashboard/rules", label: "Rules" },
  { key: "style", href: "/dashboard/style", label: "Style" },
  { key: "timestamps", href: "/dashboard/timestamps", label: "Timestamps" },
] as const;

// Section links shared by the dashboard pages. Alerts and settings stay on the
// overview page, below the numbers. Timestamps, Media, Rules and Style show only for creators they are
// switched on for.
export async function DashboardNav({ current }: { current: "overview" | "tips" | "sounds" | "media" | "rules" | "style" | "timestamps" }) {
  const features = await getSessionFeatures();
  const links = LINKS.filter(
    (l) => (l.key !== "timestamps" || features.timestamps) && (l.key !== "media" || features.customAlertMedia) &&
      (l.key !== "rules" || features.alertRules) && (l.key !== "style" || features.overlayThemes),
  );
  return <SlidingNav items={links.map((l) => ({ ...l }))} current={current} label="Dashboard" />;
}
