import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PreviewHost } from "@/app/page-preview/[id]/PreviewHost";
import { fixturesEnabled } from "@/lib/page-fixtures";
import { defaultPageDoc, ownerPageDoc } from "@/lib/page-doc/defaults";
import { fixtureData } from "../tip/fixture-data";

// The editor's preview frame with a made-up creator and no database, for the browser tests.
// 404 unless PAGE_FIXTURES=1 (only the Playwright config sets it). `?page=default|owner` picks
// the starting document. It allows framing by this site like the real preview route does, so the
// frame header is set for this path in next.config.ts too.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Preview fixture", robots: { index: false, follow: false } };

export default async function PreviewFixture({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  if (!fixturesEnabled()) notFound();
  const { page } = await searchParams;
  const owner = page === "owner";
  return <PreviewHost data={fixtureData(owner, owner ? ownerPageDoc() : defaultPageDoc(), { editing: true })} />;
}
