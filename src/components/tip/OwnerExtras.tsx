"use client";

import { ladderFraction, ladderLevel } from "@/lib/page-doc/ladder";
import type { Ladder } from "@/lib/page-doc/types";

// Small pieces a tip page can add to the normal layout. They draw the words they are given; the
// page document (parsed first) supplies them. The words may be as long as the parser allows with
// no spaces in them, so each run of text may break anywhere rather than push the page sideways.

// The thin bar in the amount box: it fills as the amount rises, with a rank word from the ladder.
export function PressureBar({
  amountRupees,
  minRupees,
  ladder,
}: {
  amountRupees: number;
  minRupees: number;
  ladder: Ladder;
}) {
  const f = ladderFraction(amountRupees, minRupees, ladder.topRupees);
  const level = ladderLevel(f, ladder.levels);
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
      <span aria-hidden="true" className="w-24 text-right text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-text [overflow-wrap:anywhere]">
        {level}
      </span>
    </div>
  );
}

// The line under the form card, like the strip at the bottom of the stream screens.
export function OwnerStrip({ left, right }: { left: string; right: string }) {
  return (
    <p
      className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-line/60 pt-3 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-muted [overflow-wrap:anywhere]"
    >
      <span>{left}</span>
      <span>{right}</span>
    </p>
  );
}

// Under the creator column: a small line of words and an Instagram link. The link is built from
// the handle alone (the parser only lets a plain handle through), never from a typed address.
export function OwnerLinks({ tagline, instagram }: { tagline: string; instagram: string }) {
  if (!tagline && !instagram) return null;
  return (
    <div className="space-y-2 px-1">
      {tagline && (
        <p className="flex items-center gap-3 text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-muted [overflow-wrap:anywhere]">
          <span aria-hidden="true" className="h-px w-6 bg-accent" />
          {tagline}
        </p>
      )}
      {instagram && (
        <a
          href={`https://www.instagram.com/${instagram}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm text-muted transition-colors [overflow-wrap:anywhere] hover:text-text"
        >
          @{instagram}
          <span className="sr-only"> on Instagram (opens in a new tab)</span>
        </a>
      )}
    </div>
  );
}
