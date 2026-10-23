"use client";

import { useState } from "react";
import { AlertStage, type OverlayAlert } from "./AlertStage";

// Sample alerts, labelled as samples on the page. Not real tips.
const SAMPLES: OverlayAlert[] = [
  { id: 0, kind: "alert", name: "Riya", amountPaise: 25000, message: "Great stream today!" },
  { id: 0, kind: "alert", name: "Anonymous", amountPaise: 9900, message: null },
  {
    id: 0,
    kind: "alert",
    name: "Aarav",
    amountPaise: 50000,
    message: "Loved the last clutch, please play the ranked match tomorrow too.",
  },
];

const SIZES = [
  { key: "1080p", label: "1080p", px: "1920 × 1080", ratio: 16 / 9 },
  { key: "1440p", label: "2K", px: "2560 × 1440", ratio: 16 / 9 },
  { key: "vertical", label: "Vertical", px: "1080 × 1920", ratio: 9 / 16 },
] as const;

export function OverlayPreview() {
  const [sizeKey, setSizeKey] = useState<(typeof SIZES)[number]["key"]>("1080p");
  const size = SIZES.find((s) => s.key === sizeKey)!;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-6 py-10">
      <div className="space-y-2">
        <h1 className="display text-[clamp(1.75rem,6vw,2.5rem)]">Alert preview</h1>
        <p className="text-sm text-muted">
          Sample alerts only, not real tips. 1080p and 2K share one layout drawn at their own
          size; vertical is stacked for portrait scenes.
        </p>
      </div>

      <div role="group" aria-label="Screen size" className="flex flex-wrap gap-2">
        {SIZES.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={s.key === sizeKey}
            onClick={() => setSizeKey(s.key)}
            className={`h-10 rounded-full border px-4 text-sm transition-colors ${
              s.key === sizeKey
                ? "border-accent bg-accent text-ink font-semibold"
                : "border-control text-text hover:border-accent"
            }`}
          >
            {s.label} <span className="opacity-70">{s.px}</span>
          </button>
        ))}
      </div>

      <div
        data-testid="preview-stage"
        className="mx-auto w-full overflow-hidden rounded-[var(--radius-surface)] border border-line/60"
        style={{
          aspectRatio: String(size.ratio),
          maxWidth: size.ratio < 1 ? "min(100%, 340px)" : "100%",
          background:
            "repeating-conic-gradient(#1b1d15 0% 25%, #24271c 0% 50%) 0 0 / 24px 24px",
        }}
      >
        <AlertStage key={sizeKey} samples={SAMPLES} />
      </div>
    </div>
  );
}
