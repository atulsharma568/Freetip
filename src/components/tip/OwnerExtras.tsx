"use client";

import { OWNER_COPY, pressureFraction, pressureLevel } from "@/lib/owner-page";

// Small pieces only the owner's tip page adds to the normal layout.

// The thin bar in the amount box: it fills as the amount rises, with a One Piece bounty word.
export function PressureBar({ amountRupees, minRupees }: { amountRupees: number; minRupees: number }) {
  const f = pressureFraction(amountRupees, minRupees);
  const level = pressureLevel(f);
  return (
    <div
      role="img"
      aria-label={`Pressure: ${level}, ₹${amountRupees.toLocaleString("en-IN")}`}
      className="flex items-center gap-3 pt-1"
    >
      <span aria-hidden="true" className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-muted">
        Pressure
      </span>
      <span aria-hidden="true" className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-line/60">
        <span
          className={`ap-fill absolute inset-y-0 left-0 rounded-full bg-accent ${f >= 0.95 ? "ap-hot" : ""}`}
          style={{ width: `${Math.max(3, f * 100)}%` }}
        />
      </span>
      <span aria-hidden="true" className="w-24 text-right text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-text">
        {level}
      </span>
    </div>
  );
}

// The line under the form card, like the strip at the bottom of the stream screens.
export function OwnerStrip() {
  return (
    <p
      className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-line/60 pt-3 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-muted"
    >
      <span>{OWNER_COPY.youtubeLabel}</span>
      <span>@{OWNER_COPY.instagram}</span>
    </p>
  );
}

// Under the creator column: the small tagline from the owner's stream screens and the Instagram.
export function OwnerLinks() {
  return (
    <div className="space-y-2 px-1">
      <p className="flex items-center gap-3 text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-muted">
        <span aria-hidden="true" className="h-px w-6 bg-accent" />
        {OWNER_COPY.tagline}
      </p>
      <a
        href={`https://www.instagram.com/${OWNER_COPY.instagram}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-sm text-muted transition-colors hover:text-text"
      >
        @{OWNER_COPY.instagram}
        <span className="sr-only"> on Instagram (opens in a new tab)</span>
      </a>
    </div>
  );
}
