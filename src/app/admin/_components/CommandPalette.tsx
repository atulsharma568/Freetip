"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { MagnifyingGlass, UserCircle } from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import { navGroupsFor } from "./nav-items";

type Entry = { key: string; href: string; label: string; hint: string; group: string; icon: Icon; badge?: number };

// Ctrl+K (or Cmd+K) opens a list of every owner page and a "find this creator" row. Arrow keys move,
// Enter goes, Escape closes. Without scripts the header button is simply absent and the sidebar and
// creator search still work.
export function CommandPalette({ badges, viewer = false }: { badges: Record<string, number>; viewer?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const entries = useMemo<Entry[]>(
    () =>
      navGroupsFor(viewer).flatMap((g) =>
        g.items.map((i) => ({ key: i.href, href: i.href, label: i.label, hint: i.hint, group: g.title, icon: i.icon, badge: badges[i.href] })),
      ),
    [badges, viewer],
  );

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => {
    const pages = q ? entries.filter((e) => `${e.label} ${e.hint} ${e.group}`.toLowerCase().includes(q)) : entries;
    if (!q) return pages;
    const find: Entry = {
      key: "find-creator",
      href: `/admin/creators?q=${encodeURIComponent(query.trim())}`,
      label: `Find creator “${query.trim()}”`,
      hint: "Searches name, email, handle, channel and UPI ID",
      group: "Search",
      icon: UserCircle,
    };
    return [find, ...pages];
  }, [entries, q, query]);

  function close() {
    setOpen(false);
    setQuery("");
    setIndex(0);
    opener.current?.focus();
  }

  function go(e: Entry) {
    setOpen(false);
    setQuery("");
    setIndex(0);
    router.push(e.href);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        opener.current = document.activeElement as HTMLElement | null;
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  // Keep the highlighted row on screen while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    document.getElementById(`palette-opt-${index}`)?.scrollIntoView({ block: "nearest" });
  }, [index, open]);

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, Math.max(shown.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = shown[index];
      if (hit) go(hit);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          opener.current = e.currentTarget;
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-control bg-surface/60 px-4 text-sm text-muted transition-colors hover:border-text/40 hover:text-text"
      >
        <MagnifyingGlass aria-hidden="true" size={16} />
        <span>Jump to</span>
        <kbd aria-hidden="true" className="numeric hidden rounded border border-control px-1.5 text-xs sm:block">
          Ctrl K
        </kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]" role="presentation">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Jump to a page or creator"
            className="relative w-full max-w-xl overflow-hidden rounded-surface border border-line bg-raised shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <MagnifyingGlass aria-hidden="true" size={18} className="shrink-0 text-muted" />
              <input
                ref={input}
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-list"
                aria-activedescendant={shown.length ? `palette-opt-${index}` : undefined}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIndex(0);
                }}
                onKeyDown={onInputKey}
                placeholder="Type a page, or a creator to find"
                autoComplete="off"
                className="min-h-14 w-full bg-transparent text-base text-text placeholder:text-muted focus:outline-none"
              />
              <kbd aria-hidden="true" className="numeric shrink-0 rounded border border-control px-1.5 text-xs text-muted">
                Esc
              </kbd>
            </div>
            <ul id="palette-list" role="listbox" data-lenis-prevent className="max-h-[50vh] overflow-y-auto p-2">
              {shown.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Nothing matches.</li>}
              {shown.map((e, i) => {
                const Glyph = e.icon;
                const on = i === index;
                return (
                  <li
                    key={e.key}
                    id={`palette-opt-${i}`}
                    role="option"
                    aria-selected={on}
                    onMouseMove={() => setIndex(i)}
                    onClick={() => go(e)}
                    className={`flex cursor-pointer items-center gap-3 rounded-field px-3 py-2.5 ${on ? "bg-accent text-ink" : "text-text"}`}
                  >
                    <Glyph aria-hidden="true" size={20} weight={on ? "fill" : "regular"} className="shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{e.label}</span>
                      <span className={`block truncate text-xs ${on ? "text-ink/75" : "text-muted"}`}>{e.hint}</span>
                    </span>
                    {e.badge ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${on ? "bg-ink text-accent" : "bg-accent text-ink"}`}>
                        {e.badge}
                        <span className="sr-only"> waiting</span>
                      </span>
                    ) : (
                      <span className={`shrink-0 text-xs ${on ? "text-ink/70" : "text-muted"}`}>{e.group}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
