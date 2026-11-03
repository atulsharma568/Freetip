import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCreator, getCreatorAccent, getPinOffer, getTipBanner, getTipPhoto, getTipRules, getTipSounds } from "./creator";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { PageShell } from "@/components/PageShell";
import { MIN_TIP_PAISE } from "@/lib/money";
import { isClosedGoogleId } from "@/lib/account-close";
import { TipPageView } from "./TipPageView";
import { isOwnerTipPage, ownerBrand } from "@/lib/owner-page";
import { defaultPageDoc, ownerPageDoc } from "@/lib/page-doc/defaults";
import { NotReady } from "./NotReady";
import { SITE_NAME } from "@/lib/site";
import { HANDLE_PATTERN } from "@/lib/waitlist";
import { ttsAvailable } from "@/lib/tts";
import { effectiveTtsMinPaise, getTtsFloorPaise } from "@/lib/site-settings";

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

  const ownerPage = isOwnerTipPage(handle, creator.google_id);
  const displayName = ownerPage ? ownerBrand() : (creator.display_name ?? creator.name ?? handle);
  const [sounds, rules, pinOffer, bannerUrl, tipPhoto] = await Promise.all([
    getTipSounds(handle),
    getTipRules(handle),
    getPinOffer(handle),
    getTipBanner(handle),
    getTipPhoto(handle),
  ]);
  // The voice is offered only when the site switch and the creator both have it on.
  const voiceMinPaise =
    ttsAvailable() && creator.tts_enabled ? effectiveTtsMinPaise(creator.tts_min_paise, await getTtsFloorPaise(getDb())) : null;

  // The page is drawn from a document of blocks. The owner's page is always the channel's red
  // (its document carries the colour), whatever accent is saved.
  const doc = ownerPage ? ownerPageDoc() : defaultPageDoc();
  const storedAccent = ownerPage ? null : await getCreatorAccent(handle);

  return (
    <TipPageView
      data={{
        handle,
        displayName,
        doc,
        storedAccent,
        pictureUrl: tipPhoto ?? creator.picture_url,
        bannerUrl,
        ytChannelName: creator.yt_channel_name,
        ytChannelUrl: creator.yt_channel_url,
        minTipPaise: MIN_TIP_PAISE,
        messageMaxChars: creator.message_max_chars,
        bio: creator.bio,
        alertMode: creator.alert_mode,
        sounds,
        rules,
        voiceMinPaise,
        pinOffer,
        previewMode: creator.creator_status !== "active",
      }}
    />
  );
}
