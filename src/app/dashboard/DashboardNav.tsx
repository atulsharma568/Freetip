import { getSessionFeatures } from "@/lib/creator-features";
import { SlidingNav } from "./parts/SlidingNav";

const LINKS = [
  { key: "overview", href: "/dashboard", label: "Overview" },
  { key: "tips", href: "/dashboard/tips", label: "Tips" },
  { key: "sounds", href: "/dashboard/sounds", label: "Sounds" },
  { key: "timestamps", href: "/dashboard/timestamps", label: "Timestamps" },
] as const;

// Section links shared by the dashboard pages. Alerts and settings stay on the
// overview page, below the numbers. Timestamps shows only for creators it is switched on for.
export async function DashboardNav({ current }: { current: "overview" | "tips" | "sounds" | "timestamps" }) {
  const features = await getSessionFeatures();
  const links = LINKS.filter((l) => l.key !== "timestamps" || features.timestamps);
  return <SlidingNav items={links.map((l) => ({ ...l }))} current={current} label="Dashboard" />;
}
