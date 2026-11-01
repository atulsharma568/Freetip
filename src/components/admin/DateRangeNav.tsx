"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { RangePreset } from "@/lib/admin/date-range";

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
];

// The period picker. Each preset is a real link (so it can be opened in a new tab
// and shared), and the current one is marked with aria-current.
export function DateRangeNav({ current }: { current: RangePreset }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function hrefFor(preset: RangePreset) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", preset);
    return `${pathname}?${params.toString()}`;
  }

  return (
    <nav aria-label="Date range" className="flex flex-wrap gap-2">
      {PRESETS.map(({ value, label }) => {
        const active = current === value;
        return (
          <Link
            key={value}
            href={hrefFor(value)}
            aria-current={active ? "true" : undefined}
            className={`inline-flex min-h-9 items-center rounded-full px-4 text-sm font-medium transition-colors ${
              active
                ? "bg-accent text-ink"
                : "border border-control text-muted hover:border-text/40 hover:text-text"
            }`}
          >
            {label}
          </Link>
        );
      })}
      <span className="ml-auto self-center text-xs text-muted">IST (Asia/Kolkata)</span>
    </nav>
  );
}
