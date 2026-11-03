"use client";

import { QrTile } from "@/components/tip/CreatorPanel";
import { useTipForm } from "@/components/tip/TipFormContext";

// The QR code to this page, shown on a laptop.
export function QrBlock() {
  const { handle } = useTipForm();
  return <QrTile handle={handle} />;
}
