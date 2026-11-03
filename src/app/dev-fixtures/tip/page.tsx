import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { BackdropBlock } from "@/components/tip/blocks/BackdropBlock";
import { MIN_TIP_PAISE } from "@/lib/money";
import { fixturesEnabled } from "@/lib/page-fixtures";
import { ownerBrand } from "@/lib/owner-page";
import { findBlock } from "@/lib/page-doc/blocks";
import { defaultPageDoc, ownerPageDoc } from "@/lib/page-doc/defaults";
import { pageDocOrDefault } from "@/lib/page-doc/parse";
import { themeFor } from "@/lib/page-doc/theme";
import { TipPageView, type TipPageData } from "../../[handle]/TipPageView";
import { SuccessFixture } from "./SuccessFixture";

// A test-only tip page with a made-up creator, so the browser tests can look at the real page
// components without a database. 404 unless PAGE_FIXTURES=1 (only the Playwright config sets it).
//   /dev-fixtures/tip?page=default|owner&view=form|success&doc=<base64url text>&editing=1&min=<rupees>
// `editing=1` marks the blocks as the owner's editor preview does; `min` sets the smallest tip.
// `doc` is a page document as text (anything the parser takes); without one, or with one the
// parser refuses, the page shows its own default document.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tip page fixture", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ page?: string; view?: string; doc?: string; editing?: string; min?: string }> };

export default async function TipFixturePage({ searchParams }: Props) {
  if (!fixturesEnabled()) notFound();
  const { page, view, doc: rawDoc, editing, min } = await searchParams;
  const owner = page === "owner";
  const fallback = owner ? ownerPageDoc() : defaultPageDoc();
  const doc = rawDoc ? pageDocOrDefault(Buffer.from(rawDoc, "base64url").toString("utf8"), fallback) : fallback;
  const theme = themeFor(doc, null);

  if (view === "success") {
    const backdrop = findBlock(doc, "backdrop");
    return (
      <PageShell slim>
        <div className="contents" style={theme.style}>
          {backdrop?.visible && <BackdropBlock />}
          <SuccessFixture doc={doc} owner={owner} />
        </div>
      </PageShell>
    );
  }

  const data: TipPageData = {
    handle: "samplecreator",
    displayName: owner ? ownerBrand() : "Sample Creator",
    doc,
    storedAccent: null,
    pictureUrl: "/owner/kitsune.svg",
    bannerUrl: null,
    ytChannelName: "Sample Channel",
    ytChannelUrl: "https://www.youtube.com/@samplechannel",
    minTipPaise: Number.isInteger(Number(min)) && Number(min) >= 1 ? Number(min) * 100 : MIN_TIP_PAISE,
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
    editing: editing === "1",
  };
  return <TipPageView data={data} />;
}
