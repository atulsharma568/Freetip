"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Tip {
  id: number;
  name: string;
  amountPaise: number;
  message: string | null;
}

const POLL_MS = 8000;
const SHOW_MS = 6000;
const SHOW_WITH_MESSAGE_MS = 10000;
const LEAVE_MS = 350;

const rupees = (paise: number) =>
  (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });

// A pill that rises from the bottom of the dashboard when a tip lands, opens to
// show the fan's message, then folds away. Tips queue up and play one by one.
// Polling is paused while the tab is hidden, and the pill holds still while it
// is hovered or focused so a long message can be read.
export function TipIsland({ initialLastId }: { initialLastId: number }) {
  const lastId = useRef(initialLastId);
  const queue = useRef<Tip[]>([]);
  const busy = useRef(false);
  const [current, setCurrent] = useState<Tip | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [held, setHeld] = useState(false);

  const advance = useCallback(() => {
    if (busy.current) return;
    const next = queue.current.shift();
    if (!next) return;
    busy.current = true;
    setLeaving(false);
    setCurrent(next);
  }, []);

  useEffect(() => {
    let stopped = false;
    async function poll() {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/dashboard/tips?after=${lastId.current}`, {
          cache: "no-store",
        });
        if (!res.ok || stopped) return;
        const data = (await res.json()) as { tips: Tip[] };
        if (!data.tips.length) return;
        lastId.current = data.tips[data.tips.length - 1].id;
        queue.current.push(...data.tips);
        advance();
      } catch {
        // Offline or a blip: the next poll tries again.
      }
    }
    const interval = setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [advance]);

  // Fold the pill away after its time, unless it is being read.
  useEffect(() => {
    if (!current || leaving || held) return;
    const timer = setTimeout(
      () => setLeaving(true),
      current.message ? SHOW_WITH_MESSAGE_MS : SHOW_MS,
    );
    return () => clearTimeout(timer);
  }, [current, leaving, held]);

  // Once folded, clear it and start the next tip in the queue.
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => {
      busy.current = false;
      setCurrent(null);
      setHeld(false);
      advance();
    }, LEAVE_MS);
    return () => clearTimeout(timer);
  }, [leaving, advance]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
    >
      {current && (
        <div
          key={current.id}
          data-leaving={leaving || undefined}
          onPointerEnter={() => setHeld(true)}
          onPointerLeave={() => setHeld(false)}
          onFocus={() => setHeld(true)}
          onBlur={() => setHeld(false)}
          tabIndex={0}
          className="tip-island pointer-events-auto w-full max-w-sm rounded-[var(--radius-surface)] border border-control bg-raised p-4 focus-visible:border-accent"
        >
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-base font-bold text-ink"
            >
              ₹
            </span>
            <p className="min-w-0 flex-1 truncate text-sm text-muted">
              <span className="font-medium text-text">{current.name}</span> tipped
            </p>
            <p className="numeric text-lg font-semibold text-accent">
              ₹{rupees(current.amountPaise)}
            </p>
          </div>
          {current.message && (
            <div className="tip-island-message">
              <p className="min-h-0 overflow-hidden break-words pt-3 text-base text-text">
                {current.message}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
