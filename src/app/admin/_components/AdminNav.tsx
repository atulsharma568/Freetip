"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Item = { href: string; label: string };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Operate",
    items: [
      { href: "/admin", label: "Overview" },
      { href: "/admin/creators", label: "Creators" },
      { href: "/admin/handle-requests", label: "Handle requests" },
      { href: "/admin/messages", label: "Messages" },
      { href: "/admin/sounds", label: "Sounds" },
      { href: "/admin/media", label: "Alert media" },
      { href: "/admin/tts-words", label: "Voice words" },
    ],
  },
  {
    title: "Money",
    items: [
      { href: "/admin/finance", label: "Finance" },
      { href: "/admin/finance/creators", label: "Creator earnings" },
      { href: "/admin/finance/balances", label: "Balances" },
      { href: "/admin/finance/payments", label: "Payment ledger" },
      { href: "/admin/finance/settlements", label: "Settlements" },
      { href: "/admin/reconciliation", label: "Reconciliation" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/features", label: "Paid features" },
      { href: "/admin/health", label: "Health" },
      { href: "/admin/audit", label: "Audit history" },
    ],
  },
];

// Overview and Finance have pages underneath that are their own items, so they
// only count as current on an exact match.
const EXACT = new Set(["/admin", "/admin/finance"]);

function isCurrent(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return !EXACT.has(href) && pathname.startsWith(`${href}/`);
}

export function AdminNav({ badges }: { badges: Record<string, number> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const all = GROUPS.flatMap((g) => g.items);
  const current = all.find((i) => isCurrent(pathname, i.href));
  const waiting = Object.values(badges).reduce((a, b) => a + b, 0);

  return (
    <nav aria-label="Owner console" className="lg:w-56 lg:shrink-0">
      {/* On a phone the list folds into one button so it never needs a sideways scroll. */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls="admin-nav-list"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-full border border-control px-4 text-sm text-text lg:hidden"
      >
        <span>
          Menu <span className="text-muted">· {current?.label ?? "Owner console"}</span>
        </span>
        {waiting > 0 && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-ink">
            {waiting}
            <span className="sr-only"> waiting for you</span>
          </span>
        )}
      </button>

      <div id="admin-nav-list" className={`${open ? "mt-3 block" : "hidden"} space-y-5 lg:mt-0 lg:block`}>
        {GROUPS.map((group) => (
          <div key={group.title} className="space-y-1">
            <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">{group.title}</p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = isCurrent(pathname, item.href);
                const badge = badges[item.href] ?? 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={`flex min-h-10 items-center justify-between gap-2 rounded-field px-3 text-sm transition-colors ${
                        active ? "bg-accent text-ink" : "text-muted hover:bg-raised hover:text-text"
                      }`}
                    >
                      <span>{item.label}</span>
                      {badge > 0 && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            active ? "bg-ink text-accent" : "bg-accent text-ink"
                          }`}
                        >
                          {badge}
                          <span className="sr-only"> waiting</span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
