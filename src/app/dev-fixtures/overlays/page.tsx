import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OVERLAY_FONT_CLASSES } from "@/components/overlay/fonts";
import { fixturesEnabled } from "@/lib/page-fixtures";
import { OverlaysFixture } from "./OverlaysFixture";

// The owner's overlay editor with a made-up creator and an in-memory store, for the browser tests.
// 404 unless PAGE_FIXTURES=1 (only the Playwright config sets it). `?features=all|motion` is a
// creator with every alert switch on, or only animations and timing.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Overlay editor fixture", robots: { index: false, follow: false } };

export default async function OverlaysFixturePage({ searchParams }: { searchParams: Promise<{ features?: string }> }) {
  if (!fixturesEnabled()) notFound();
  const { features } = await searchParams;
  return <OverlaysFixture motionOnly={features === "motion"} fontClasses={OVERLAY_FONT_CLASSES} />;
}
