import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { OwnerBackdrop } from "@/components/tip/OwnerBackdrop";
import { MIN_TIP_PAISE } from "@/lib/money";
import { fixturesEnabled } from "@/lib/page-fixtures";
import { ownerBrand, OWNER_ACCENT, ownerThemeStyle } from "@/lib/owner-page";
import { TipPageView, type TipPageData } from "../../[handle]/TipPageView";
import { SuccessFixture } from "./SuccessFixture";

// A test-only tip page with a made-up creator, so the browser tests can look at the real page
// components without a database. 404 unless PAGE_FIXTURES=1 (only the Playwright config sets it).
//   /dev-fixtures/tip?page=default|owner&view=form|success
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tip page fixture", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ page?: string; view?: string }> };

export default async function TipFixturePage({ searchParams }: Props) {
  if (!fixturesEnabled()) notFound();
  const { page, view } = await searchParams;
  const owner = page === "owner";

  if (view === "success") {
    return (
      <PageShell slim>
        <div className="contents" style={owner ? ownerThemeStyle : undefined}>
          {owner && <OwnerBackdrop />}
          <SuccessFixture owner={owner} />
        </div>
      </PageShell>
    );
  }

  const data: TipPageData = {
    handle: "samplecreator",
    displayName: owner ? ownerBrand() : "Sample Creator",
    ownerPage: owner,
    accent: owner ? OWNER_ACCENT : undefined,
    themeStyle: owner ? ownerThemeStyle : undefined,
    pictureUrl: "/owner/kitsune.svg",
    bannerUrl: null,
    ytChannelName: "Sample Channel",
    ytChannelUrl: "https://www.youtube.com/@samplechannel",
    minTipPaise: MIN_TIP_PAISE,
    messageMaxChars: 100,
    bio: "Streams games and chats with the crew most evenings.",
    alertMode: "split",
    sounds: [
      { id: 1, name: "Airhorn", emoji: "📣", minPaise: 2000, url: "/fixture/airhorn.mp3" },
      { id: 2, name: "Applause", emoji: "👏", minPaise: 5000, url: "/fixture/applause.mp3" },
      { id: 3, name: "Fanfare", emoji: "🎺", minPaise: 20000, url: "/fixture/fanfare.mp3" },
    ],
    rules: [
      { id: 1, minPaise: 10000, media: null, sound: { url: "/fixture/pick-one.mp3", name: "Pick one" }, staySeconds: null },
      { id: 2, minPaise: 50000, media: null, sound: { url: "/fixture/pick-two.mp3", name: "Pick two" }, staySeconds: 12 },
    ],
    voiceMinPaise: 5000,
    pinOffer: { minPaise: 20000, seconds: 30 },
    previewMode: false,
  };
  return <TipPageView data={data} />;
}
