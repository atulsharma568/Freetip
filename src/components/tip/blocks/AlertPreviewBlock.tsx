"use client";

import { AlertCard } from "@/components/tip/AlertCard";
import { useTipForm } from "@/components/tip/TipFormContext";

const sectionLabel = "text-sm font-medium uppercase tracking-widest text-muted";

// The alert as it will look on stream, live from what the fan has typed. The layout draws it twice
// (beside the form on a laptop, between the amount and the note on a phone).
export function AlertPreviewBlock() {
  const { alertName, amountRupees, message } = useTipForm();
  return (
    <>
      <p className={sectionLabel}>Preview on stream</p>
      <AlertCard name={alertName} amountRupees={amountRupees} message={message.trim()} />
      <p className="text-xs text-muted">Your message may appear on stream.</p>
    </>
  );
}
