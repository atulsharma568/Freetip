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

export default function EffectsFixturePage() {
  if (!fixturesEnabled()) notFound();
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <EffectsManager saved={{ template: "classic", avatar: "none", frame: "none", bannerFx: "clutch", bannerPic: "none", avatarUpload: null, frameUpload: null, frameScale: 144 }} style={themeFor(ownerPageDoc(), null).style ?? {}} pictureUrl={null} name="AcePressure" />
    </main>
  );
}
