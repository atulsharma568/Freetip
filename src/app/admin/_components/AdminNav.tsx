"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  At,
  Bank,
  ChartBar,
  ChatText,
  ClockCounterClockwise,
  Coins,
  Envelope,
  FilmSlate,
  Gear,
  Heartbeat,
  MagnifyingGlass,
  Percent,
  Receipt,
  Scales,
  Sparkle,
  SpeakerHigh,
  SquaresFour,
  Users,
  ArrowsLeftRight,
  type Icon,
} from "@phosphor-icons/react";
import { FIELD_CLASS } from "@/components/admin/tones";

type Item = { href: string; label: string; icon: Icon };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Operate",
    items: [
      { href: "/admin", label: "Overview", icon: SquaresFour },
      { href: "/admin/creators", label: "Creators", icon: Users },
      { href: "/admin/handle-requests", label: "Handle requests", icon: At },
      { href: "/admin/messages", label: "Messages", icon: Envelope },
      { href: "/admin/sounds", label: "Sounds", icon: SpeakerHigh },
      { href: "/admin/media", label: "Alert media", icon: FilmSlate },
      { href: "/admin/tts-words", label: "Voice words", icon: ChatText },
    ],
  },
  {
    title: "Money",
    items: [
      { href: "/admin/finance", label: "Finance", icon: Coins },
      { href: "/admin/finance/creators", label: "Creator earnings", icon: ChartBar },
      { href: "/admin/fees", label: "Fee rates", icon: Percent },
      { href: "/admin/finance/balances", label: "Balances", icon: Scales },
      { href: "/admin/finance/payments", label: "Payment ledger", icon: Receipt },
      { href: "/admin/finance/settlements", label: "Settlements", icon: Bank },
      { href: "/admin/reconciliation", label: "Reconciliation", icon: ArrowsLeftRight },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/features", label: "Paid features", icon: Sparkle },
      { href: "/admin/settings", label: "Site settings", icon: Gear },
      { href: "/admin/health", label: "Health", icon: Heartbeat },
      { href: "/admin/audit", label: "Audit history", icon: ClockCounterClockwise },
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

// Finds a creator from any owner page. A plain GET form to the creators list (which
// searches name, email, handle, channel and UPI ID across every tab), so it works without
// scripts; the "/" key jumps to it unless the owner is typing somewhere.
function CreatorFinder() {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      input.current?.focus();
      input.current?.select();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form action="/admin/creators" role="search" className="relative">
      <label htmlFor="admin-find" className="sr-only">
        Find a creator
      </label>
      <MagnifyingGlass
        aria-hidden="true"
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
      />
      <input
        ref={input}
        id="admin-find"
        type="search"
        name="q"
        placeholder="Find a creator"
        autoComplete="off"
        aria-keyshortcuts="/"
        className={`${FIELD_CLASS} min-h-11 w-full pl-9 pr-9 focus:border-accent`}
      />
      <kbd
        aria-hidden="true"
        className="numeric pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-control px-1.5 text-xs text-muted lg:block"
      >
        /
      </kbd>
      <button type="submit" className="sr-only">
        Search creators
      </button>
    </form>
  );
}

export function AdminNav({ badges }: { badges: Record<string, number> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const all = GROUPS.flatMap((g) => g.items);
  const current = all.find((i) => isCurrent(pathname, i.href));
  const waiting = Object.values(badges).reduce((a, b) => a + b, 0);

  return (
    <div data-lenis-prevent className="space-y-3 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:w-60 lg:shrink-0 lg:self-start lg:overflow-y-auto lg:pr-1">
      <CreatorFinder />

      <nav aria-label="Owner console">
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
                  const Glyph = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setOpen(false)}
                        className={`flex min-h-10 items-center gap-2.5 rounded-field px-3 text-sm transition-colors ${
                          active ? "bg-accent font-medium text-ink" : "text-muted hover:bg-raised hover:text-text"
                        }`}
                      >
                        <Glyph aria-hidden="true" size={18} weight={active ? "fill" : "regular"} className="shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
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
    </div>
  );
}
