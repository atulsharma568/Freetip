"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { RangePreset } from "@/lib/admin/date-range";

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
];

export function DateRangeNav({ current }: { current: RangePreset }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function select(preset: RangePreset) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", preset);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map(({ value, label }) => {
        const active = current === value;
        return (
          <button
            key={value}
            onClick={() => select(value)}
            className={`inline-flex min-h-9 items-center rounded-full px-4 text-sm font-medium transition-colors ${
              active
                ? "bg-accent text-ink"
                : "border border-control text-muted hover:border-text/30 hover:text-text"
            }`}
          >
            {label}
          </button>
        );
      })}
      <span className="ml-auto self-center text-xs text-muted">IST (Asia/Kolkata)</span>
    </div>
  );
}
