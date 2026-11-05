import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fixturesEnabled } from "@/lib/page-fixtures";
import { CreatorPanel } from "@/components/tip/CreatorPanel";
import type { DecorRender } from "@/components/tip/Decor";

// A test-only creator header with a picture frame and a picture effect (a small drawing standing in
// for an uploaded animated WebP), so the browser tests can check the frame's size and that an effect
// can cover the whole header. `?scale=` is the frame size in percent, `?area=header` makes the effect
// cover the whole header. 404 unless PAGE_FIXTURES=1.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Decor fixture", robots: { index: false, follow: false } };

const SVG = (body: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${body}</svg>`)}`;
const RING = SVG(`<circle cx="50" cy="50" r="46" fill="none" stroke="#ca1b19" stroke-width="6"/>`);
const FOG = SVG(`<rect width="100" height="100" fill="#3c6" fill-opacity="0.25"/>`);

export default async function DecorFixture({ searchParams }: { searchParams: Promise<{ scale?: string; area?: string }> }) {
  if (!fixturesEnabled()) notFound();
  const { scale, area } = await searchParams;
  const frame: DecorRender = { kind: "custom", url: RING, posterUrl: null, animated: false, scale: scale ? Number(scale) : undefined };
  const fx: DecorRender = { kind: "custom", url: FOG, posterUrl: null, animated: false };
  return (
    <main className="mx-auto w-full max-w-md px-6 py-8">
      <CreatorPanel
        displayName="Fixture"
        pictureUrl={null}
        ytChannelName={null}
        ytChannelUrl={null}
        bio="A short bio line."
        previewMode
        frame={frame}
        bannerFx={fx}
        fxWholeHeader={area === "header"}
      />
    </main>
  );
}
