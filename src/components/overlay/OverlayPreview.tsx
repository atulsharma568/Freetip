"use client";

import { useState } from "react";
import { AlertStage, type OverlayAlert } from "./AlertStage";

// Sample alerts, labelled as samples on the page. Not real tips. One per tip size
// (tip-tier.ts: the card grows from ₹100, ₹500 and ₹2,000) plus a test alert.
const SAMPLES = [
  { key: "250", label: "₹250", alert: { id: 0, kind: "alert", name: "Riya", amountPaise: 25000, message: "Great stream today!" } },
  { key: "99", label: "₹99", alert: { id: 0, kind: "alert", name: "Anonymous", amountPaise: 9900, message: null } },
  {
    key: "500",
    label: "₹500",
    alert: {
      id: 0,
      kind: "alert",
      name: "Kabir",
      amountPaise: 50000,
      message: "Loved the last clutch, please play the ranked match tomorrow too.",
    },
  },
  {
    key: "2000",
    label: "₹2,000",
    alert: { id: 0, kind: "alert", name: "Meera", amountPaise: 200000, message: "Best stream I have watched all year." },
  },
  {
    key: "test",
    label: "Test",
    alert: {
      id: 0,
      kind: "alert",
      name: "Test alert",
      amountPaise: 4900,
      message: "This is a test from your dashboard.",
      test: true,
    },
  },
] as const satisfies readonly { key: string; label: string; alert: OverlayAlert }[];

const ALL: OverlayAlert[] = SAMPLES.map((s) => s.alert);

const SIZES = [
  { key: "1080p", label: "1080p", px: "1920 × 1080", ratio: 16 / 9 },
  { key: "1440p", label: "2K", px: "2560 × 1440", ratio: 16 / 9 },
  { key: "vertical", label: "Vertical", px: "1080 × 1920", ratio: 9 / 16 },
] as const;

const CHIP =
  "inline-flex h-11 items-center rounded-full border px-4 text-sm transition-colors duration-150";
const CHIP_OFF = "border-control text-text hover:border-muted";
const CHIP_ON = "border-accent bg-accent font-semibold text-ink";

export function OverlayPreview() {
  const [sizeKey, setSizeKey] = useState<(typeof SIZES)[number]["key"]>("1080p");
  const [sampleKey, setSampleKey] = useState<"all" | (typeof SAMPLES)[number]["key"]>("all");
  const size = SIZES.find((s) => s.key === sizeKey)!;
  const samples = sampleKey === "all" ? ALL : [SAMPLES.find((s) => s.key === sampleKey)!.alert];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-6 py-10">
      <div className="space-y-2">
        <h1 className="display text-[clamp(1.75rem,6vw,2.5rem)]">Alert preview</h1>
        <p className="text-sm text-muted">
          Sample alerts only, not real tips. 1080p and 2K share one layout drawn at their own
          size; vertical is stacked for portrait scenes. The card grows with the tip, and the
          message lights word by word as the voice would read it.
        </p>
      </div>

      <div role="group" aria-label="Screen size" className="flex flex-wrap gap-2">
        {SIZES.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={s.key === sizeKey}
            onClick={() => setSizeKey(s.key)}
            className={`${CHIP} ${s.key === sizeKey ? CHIP_ON : CHIP_OFF}`}
          >
            {s.label} <span className="ml-2 font-mono text-xs opacity-80">{s.px}</span>
          </button>
        ))}
      </div>

      <div role="group" aria-label="Sample tip" className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={sampleKey === "all"}
          onClick={() => setSampleKey("all")}
          className={`${CHIP} ${sampleKey === "all" ? CHIP_ON : CHIP_OFF}`}
        >
          All samples
        </button>
        {SAMPLES.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={s.key === sampleKey}
            onClick={() => setSampleKey(s.key)}
            className={`${CHIP} ${s.key !== "test" ? "font-mono" : ""} ${s.key === sampleKey ? CHIP_ON : CHIP_OFF}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div
        data-testid="preview-stage"
        className="mx-auto w-full overflow-hidden rounded-surface border border-line"
        style={{
          aspectRatio: String(size.ratio),
          maxWidth: size.ratio < 1 ? "min(100%, 340px)" : "100%",
          background: "var(--color-surface)",
        }}
      >
        <AlertStage key={`${sizeKey}-${sampleKey}`} samples={samples} />
      </div>
    </div>
  );
}
