import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { BackdropBlock } from "@/components/tip/blocks/BackdropBlock";
import { fixturesEnabled } from "@/lib/page-fixtures";
import { findBlock } from "@/lib/page-doc/blocks";
import { defaultPageDoc, ownerPageDoc } from "@/lib/page-doc/defaults";
import { pageDocOrDefault } from "@/lib/page-doc/parse";
import { themeFor } from "@/lib/page-doc/theme";
import { TipPageView } from "../../[handle]/TipPageView";
import { FIXTURE_ASSETS, fixtureData } from "./fixture-data";
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
          {backdrop?.visible && <BackdropBlock block={backdrop} asset={backdrop.settings.asset === null ? null : (FIXTURE_ASSETS[backdrop.settings.asset] ?? null)} />}
          <SuccessFixture doc={doc} owner={owner} />
        </div>
      </PageShell>
    );
  }

  const data = fixtureData(owner, doc, { editing: editing === "1", min });
  return <TipPageView data={data} />;
}
