"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import type { SentTip } from "./TipCard";

export type FanAlert = SentTip & { id: number };

// Slots, front to back: where each alert rests, fanned out from behind the
// tip card's left edge. The fourth slot is the exit: the oldest alert fades
// there when a new one arrives.
const SLOTS = [
  { x: 0, y: 0, rotation: -4, opacity: 1 },
  { x: -30, y: -40, rotation: -11, opacity: 1 },
  { x: -54, y: -76, rotation: -18, opacity: 1 },
  { x: -70, y: -100, rotation: -24, opacity: 0 },
];
// Where a new alert starts: tucked behind the card.
const TUCKED = { x: 150, y: 10, rotation: 0, opacity: 0 };

// Sample stream alerts fanned out behind the hero tip card (wide screens
// only). Each tip the card "sends" deals a new alert to the front.
// Decorative: the card already says what was sent.
export function AlertFan({ alerts }: { alerts: FanAlert[] }) {
  const root = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<number>>(new Set());
  const mounted = useRef(false);

  useGSAP(
    () => {
      const cards = gsap.utils.toArray<HTMLElement>("[data-alert]", root.current);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      cards.forEach((card, i) => {
        const id = Number(card.dataset.alert);
        const slot = SLOTS[Math.min(i, SLOTS.length - 1)];
        const isNew = !seen.current.has(id);
        seen.current.add(id);
        if (reduce || !mounted.current) {
          gsap.set(card, slot);
        } else if (isNew) {
          gsap.fromTo(card, TUCKED, { ...slot, duration: 0.9, ease: "expo.out" });
        } else {
          gsap.to(card, { ...slot, duration: 0.8, ease: "expo.out" });
        }
      });
      mounted.current = true;
    },
    { dependencies: [alerts], scope: root },
  );

  return (
    <div
      ref={root}
      aria-hidden="true"
      className="pointer-events-none absolute bottom-28 right-[calc(100%-3.5rem)] z-0 hidden w-60 xl:block"
    >
      {alerts.map((alert, i) => (
        <div
          key={alert.id}
          data-alert={alert.id}
          data-front={i === 0}
          className="absolute bottom-0 right-0 w-60 origin-bottom-right rounded-surface border border-line bg-raised p-4 text-text transition-colors duration-500 data-[front=true]:border-accent data-[front=true]:bg-accent data-[front=true]:text-ink"
          style={{ zIndex: alerts.length - i }}
        >
          <p className="text-xs font-semibold opacity-80">Sample alert</p>
          <p className="mt-2 truncate text-sm font-medium">{alert.name} tipped</p>
          <p className="numeric mt-1 text-3xl font-semibold leading-none">₹{alert.amount}</p>
          {alert.message && (
            <p className="mt-2 truncate text-sm font-medium">{alert.message}</p>
          )}
        </div>
      ))}
    </div>
  );
}
