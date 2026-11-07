import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fixturesEnabled } from "@/lib/page-fixtures";
import { ownerPageDoc } from "@/lib/page-doc/defaults";
import { themeFor } from "@/lib/page-doc/theme";
import { BannerManager } from "@/app/dashboard/banner/BannerManager";

// A test-only copy of the dashboard's Banner page with a made-up creator, so the browser tests can
// look at it without a sign-in or a database. 404 unless PAGE_FIXTURES=1.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Banner fixture", robots: { index: false, follow: false } };

const placement = { anchor: "ring" as const, size: 144, dx: 0, dy: 0 };
const item = (id: number, name: string, url: string, ownerHandle: string | null) => ({
  id, creatorId: ownerHandle ? 9 : 7, kind: "banner" as const, name, url, posterUrl: null, mime: "image/webp",
  sizeBytes: 900_000, width: 1600, height: 500, animated: false, placement, createdAt: "2026-11-07T00:00:00.000Z", ownerHandle,
});
const library = {
  mine: [item(1, "Night city", "/decorations/solo-leveling.webp", null)],
  shared: [item(2, "Shared banner", "/decorations/peaky-blinders.webp", "mira")],
};

export default function BannerFixturePage() {
  if (!fixturesEnabled()) notFound();
  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-6 py-8">
      <BannerManager saved={null} library={library} handle="acepressure" style={themeFor(ownerPageDoc(), null).style ?? {}} displayName="AcePressure" pictureUrl={null} usingYouTubePhoto={false} ytChannelName="AcePressure" ytChannelUrl={null} bio="Test bio" creatorId={7} uploadsReady={true} />
    </main>
  );
}
