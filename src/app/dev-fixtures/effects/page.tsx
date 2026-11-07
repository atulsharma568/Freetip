import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fixturesEnabled } from "@/lib/page-fixtures";
import { ownerPageDoc } from "@/lib/page-doc/defaults";
import { themeFor } from "@/lib/page-doc/theme";
import { EffectsManager } from "@/app/dashboard/effects/EffectsManager";

// A test-only copy of the dashboard's Effects picker with a made-up owner, so the browser tests can
// look at it without a sign-in or a database. 404 unless PAGE_FIXTURES=1.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Effects fixture", robots: { index: false, follow: false } };

// Made-up saved pictures (local files, no storage): one of the creator's own and one shared by the owner.
const placement = { anchor: "ring" as const, size: 144, dx: 0, dy: 0 };
const library = {
  mine: [
    { id: 1, creatorId: 7, kind: "frame" as const, name: "Wings one", url: "/decorations/angel.webp", posterUrl: "/decorations/angel.poster.webp", mime: "image/webp", sizeBytes: 250_000, width: 512, height: 512, animated: true, placement, createdAt: "2026-11-07T00:00:00.000Z", ownerHandle: null },
    { id: 2, creatorId: 7, kind: "avatar" as const, name: "Portrait one", url: "/decorations/killua.webp", posterUrl: "/decorations/killua.poster.webp", mime: "image/webp", sizeBytes: 120_000, width: 400, height: 400, animated: true, placement, createdAt: "2026-11-06T00:00:00.000Z", ownerHandle: null },
  ],
  shared: [
    { id: 3, creatorId: 9, kind: "frame" as const, name: "Shared ring", url: "/decorations/nanami.webp", posterUrl: "/decorations/nanami.poster.webp", mime: "image/webp", sizeBytes: 180_000, width: 512, height: 512, animated: true, placement, createdAt: "2026-11-05T00:00:00.000Z", ownerHandle: "mira" },
  ],
};

export default function EffectsFixturePage() {
  if (!fixturesEnabled()) notFound();
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <EffectsManager saved={{ template: "classic", avatar: "none", frame: "none", bannerFx: "clutch", bannerPic: "none", avatarUpload: null, frameUpload: null, frameScale: 144 }} style={themeFor(ownerPageDoc(), null).style ?? {}} pictureUrl={null} name="AcePressure" creatorId={7} library={library} />
    </main>
  );
}
