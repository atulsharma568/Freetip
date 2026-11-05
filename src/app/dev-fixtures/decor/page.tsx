import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fixturesEnabled } from "@/lib/page-fixtures";
import { CreatorPanel } from "@/components/tip/CreatorPanel";
import type { DecorRender } from "@/components/tip/Decor";
import { FILE_FRAMES, isFileFrame } from "@/lib/page-doc/decor";

// A test-only creator header with a picture frame and a picture effect (a small drawing standing in
// for an uploaded animated WebP), so the browser tests can check the frame's size and that an effect
// can cover the whole header. `?scale=` is the frame size in percent, `?area=header` makes the effect
// cover the whole header, `?frame=widow` shows a finished animation that ships with the site (over a plain
// banner picture, no effect). 404 unless PAGE_FIXTURES=1.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Decor fixture", robots: { index: false, follow: false } };

const SVG = (body: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${body}</svg>`)}`;
const RING = SVG(`<circle cx="50" cy="50" r="46" fill="none" stroke="#ca1b19" stroke-width="6"/>`);
const FOG = SVG(`<rect width="100" height="100" fill="#3c6" fill-opacity="0.25"/>`);
const BANNER = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 100" preserveAspectRatio="none"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#25324f"/><stop offset="1" stop-color="#101522"/></linearGradient></defs><rect width="320" height="100" fill="url(#g)"/></svg>`)}`;

export default async function DecorFixture({ searchParams }: { searchParams: Promise<{ scale?: string; area?: string; frame?: string }> }) {
  if (!fixturesEnabled()) notFound();
  const { scale, area, frame: frameName } = await searchParams;
  const file = frameName && isFileFrame(frameName) ? FILE_FRAMES[frameName] : null;
  const frame: DecorRender = file
    ? { kind: "custom", url: file.url, posterUrl: file.posterUrl, animated: true, scale: file.scale }
    : { kind: "custom", url: RING, posterUrl: null, animated: false, scale: scale ? Number(scale) : undefined };
  const fx: DecorRender = file ? null : { kind: "custom", url: FOG, posterUrl: null, animated: false };
  return (
    <main className="mx-auto w-full max-w-md px-6 py-8">
      <CreatorPanel
        displayName="Fixture"
        pictureUrl={null}
        bannerUrl={file ? BANNER : undefined}
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
