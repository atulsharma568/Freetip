"use client";

import { useEffect, useState } from "react";
import { blockAttrs, useTipForm } from "@/components/tip/TipFormContext";
import { rupeeText } from "@/components/tip/format";
import { usableFor, type ResolvedAsset } from "@/lib/page-doc/assets";
import type { MeterReading } from "@/lib/page-doc/pressure";
import type { Block } from "@/lib/page-doc/types";
import { useMotionAllowed } from "./use-motion";

// A fan's browser asks twice a minute, only while the tab is open (the server caches the answer
// for ten seconds, so a busy page costs one lookup per ten seconds, not one per fan).
const POLL_MS = 30_000;

const paise = (value: number) => rupeeText(Math.floor(value / 100));

// The small picture beside the heading. A GIF shows its still until the device may play motion
// (see motion.ts), like a GIF banner.
function Emblem({ asset }: { asset: ResolvedAsset }) {
  const motion = useMotionAllowed();
  const src = asset.kind === "gif" && !motion ? asset.posterUrl : asset.url;
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- the owner's own upload, kept animated and unoptimised
    <img src={src} alt="" width={28} height={28} decoding="async" className="size-7 shrink-0 rounded-field object-cover" />
  );
}

// The creator's goal as a bar. The first reading is in the served page; after that it follows the
// public endpoint. It draws nothing while there is no reading (no goal), keeps the last reading on
// a network error, and goes away if the owner has switched it off. The words that follow the goal
// ("today", "this week", "Goal reached") are the goal's own, never typed by the owner.
export function PressureBlock({ block }: { block: Block<"pressureMeter"> }) {
  const { handle, previewMode, editing, meter, assets } = useTipForm();
  const [reading, setReading] = useState<MeterReading | null>(meter);

  // A new first reading (the editor preview loads again) replaces what is shown.
  const [seen, setSeen] = useState(meter);
  if (seen !== meter) {
    setSeen(meter);
    setReading(meter);
  }

  // Nothing to follow when the creator had no goal on load, or in a preview.
  const follow = !previewMode && !editing && meter !== null;
  useEffect(() => {
    if (!follow) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      clearTimeout(timer);
      try {
        const res = await fetch(`/api/pressure/${encodeURIComponent(handle)}`);
        if (res.status === 404) {
          if (!stop) setReading(null);
          return;
        }
        if (res.ok && !stop) setReading(((await res.json()) as { meter: MeterReading | null }).meter);
      } catch {
        // Keep the last bar on a network blip.
      }
      if (!stop && document.visibilityState === "visible") timer = setTimeout(poll, POLL_MS);
    }
    function onVisible() {
      if (document.visibilityState === "visible") void poll();
      else clearTimeout(timer);
    }
    timer = setTimeout(poll, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [follow, handle]);

  if (!reading) return null;

  const { fill, celebrate } = block.settings;
  const heading = block.settings.heading || "Pressure";
  const celebrating = reading.reached && celebrate;
  // A picture that is missing, taken down or the wrong kind draws nothing.
  const emblem = block.settings.picture === null ? undefined : assets[block.settings.picture];
  const rupees = reading.raisedPaise !== undefined && reading.targetPaise !== undefined;

  return (
    <section
      aria-label={heading}
      data-testid="pressure-meter"
      className={`space-y-3 rounded-[var(--radius-surface)] border bg-surface p-4 ${celebrating ? "border-accent" : "border-line/60"}`}
      {...blockAttrs(editing, block.id)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 items-center gap-2">
          {emblem && usableFor(emblem.kind, "meter") && <Emblem asset={emblem} />}
          <p className="min-w-0 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-muted [overflow-wrap:anywhere]">
            {heading}
            {reading.period && <> · {reading.period}</>}
          </p>
        </div>
        <p className="numeric text-sm font-semibold text-text">{celebrating ? "Goal reached" : `${reading.percent}%`}</p>
      </div>
      <div
        role="progressbar"
        aria-label={`${heading}: ${reading.title}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={reading.percent}
        aria-valuetext={`${reading.percent} percent, ${reading.word}`}
        className="relative h-2 overflow-hidden rounded-full border border-transparent bg-line/60"
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-accent [forced-color-adjust:none] transition-[width] duration-700 motion-reduce:transition-none"
          style={{ width: `${reading.percent}%`, ...(fill ? { backgroundColor: fill } : {}) }}
        />
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
        <p className="min-w-0 [overflow-wrap:anywhere]">
          <span className="font-semibold text-text">{reading.word}</span>
          <span className="text-muted"> · {reading.title}</span>
        </p>
        {rupees && (
          <p className="numeric text-muted">
            ₹{paise(reading.raisedPaise!)} of ₹{paise(reading.targetPaise!)}
          </p>
        )}
      </div>
      {reading.carryPaise ? <p className="text-xs text-muted">Includes ₹{paise(reading.carryPaise)} carried over.</p> : null}
    </section>
  );
}
