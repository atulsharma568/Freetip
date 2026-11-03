import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fixturesEnabled } from "@/lib/page-fixtures";
import { EditorFixture } from "./EditorFixture";

// The owner's tip page editor with a made-up creator and an in-memory store, for the browser
// tests. 404 unless PAGE_FIXTURES=1 (only the Playwright config sets it). `?page=default|owner`; `meter=off` is a creator without the Pressure meter switch.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Editor fixture", robots: { index: false, follow: false } };

export default async function EditorFixturePage({ searchParams }: { searchParams: Promise<{ page?: string; meter?: string }> }) {
  if (!fixturesEnabled()) notFound();
  const { page, meter } = await searchParams;
  return <EditorFixture owner={page === "owner"} meterSwitchOn={meter !== "off"} />;
}
