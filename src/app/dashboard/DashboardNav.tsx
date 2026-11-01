import Link from "next/link";

const LINKS = [
  { key: "overview", href: "/dashboard", label: "Overview" },
  { key: "tips", href: "/dashboard/tips", label: "Tips" },
  { key: "sounds", href: "/dashboard/sounds", label: "Sounds" },
  { key: "timestamps", href: "/dashboard/timestamps", label: "Timestamps" },
] as const;

// Section links shared by the dashboard pages. Alerts and settings stay on the
// overview page, below the numbers.
export function DashboardNav({ current }: { current: "overview" | "tips" | "sounds" | "timestamps" }) {
  return (
    <nav aria-label="Dashboard" className="flex gap-2">
      {LINKS.map((l) => (
        <Link
          key={l.key}
          href={l.href}
          aria-current={l.key === current ? "page" : undefined}
          className={`inline-flex h-11 items-center rounded-full px-5 text-sm font-medium transition-colors duration-200 ${
            l.key === current
              ? "bg-accent text-ink"
              : "border border-control text-text hover:border-accent"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
