import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCreator } from "./creator";
import { loadTipPageData } from "./tip-page-data";
import { auth } from "@/auth";
import { PageShell } from "@/components/PageShell";
import { isClosedGoogleId } from "@/lib/account-close";
import { TipPageView } from "./TipPageView";
import { isOwnerTipPage, ownerBrand } from "@/lib/owner-page";
import { NotReady } from "./NotReady";
import { SITE_NAME } from "@/lib/site";
import { HANDLE_PATTERN } from "@/lib/waitlist";

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  if (!HANDLE_PATTERN.test(handle)) return { title: SITE_NAME, robots: { index: false } };

  const creator = await getCreator(handle);
  if (!creator || creator.creator_status !== "active") {
    return { title: `${handle}: ${SITE_NAME}`, robots: { index: false } };
  }

  const displayName = isOwnerTipPage(handle, creator.google_id) ? ownerBrand() : (creator.display_name ?? creator.name ?? handle);
  const title = `Tip ${displayName} | ${SITE_NAME}`;
  const description = `Send a tip to ${displayName} on ${SITE_NAME}. No fan account or email needed.`;
  return {
    title,
    description,
    alternates: { canonical: `/${handle}` },
    openGraph: { title, description, url: `/${handle}` },
    twitter: { title, description },
  };
}

export default async function CreatorPage({ params }: Props) {
  const { handle } = await params;
  if (!HANDLE_PATTERN.test(handle)) notFound();

  const creator = await getCreator(handle);
  if (!creator || isClosedGoogleId(creator.google_id)) notFound();

  // Allow the creator to preview their own page even while pending/suspended.
  // auth() is only called for non-active creators — active pages skip it entirely.
  let isOwnPage = false;
  if (creator.creator_status !== "active") {
    const session = await auth();
    const viewerGoogleId = (session?.user as { googleId?: string })?.googleId;
    isOwnPage = !!viewerGoogleId && viewerGoogleId === creator.google_id;
  }

  if (creator.creator_status !== "active" && !isOwnPage) {
    return (
      <PageShell slim>
        <NotReady handle={handle} name={creator.name} />
      </PageShell>
    );
  }

  const data = await loadTipPageData(handle, creator, { previewMode: creator.creator_status !== "active" });
  return <TipPageView data={data} />;
}
