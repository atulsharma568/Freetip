import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBirthdayOffered, getCreator, getCreatorAccent, getPinOffer, getTipBanner, getTipRules, getTipSounds } from "./creator";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { PageShell } from "@/components/PageShell";
import { accentStyle, safeAccent } from "@/lib/accent";
import { MIN_TIP_PAISE } from "@/lib/money";
import { isClosedGoogleId } from "@/lib/account-close";
import { TipForm } from "./TipForm";
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

  const displayName = creator.display_name ?? creator.name ?? handle;
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

  const displayName = creator.display_name ?? creator.name ?? handle;
  const [sounds, rules, birthdayOffered, pinOffer, bannerUrl] = await Promise.all([
    getTipSounds(handle),
    getTipRules(handle),
    getBirthdayOffered(handle),
    getPinOffer(handle),
    getTipBanner(handle),
  ]);
  // The voice is offered only when the site switch and the creator both have it on.
  const voiceMinPaise =
    ttsAvailable() && creator.tts_enabled ? effectiveTtsMinPaise(creator.tts_min_paise, await getTtsFloorPaise(getDb())) : null;

  const storedAccent = await getCreatorAccent(handle);
  const themeStyle = accentStyle(storedAccent);

  return (
    <PageShell slim>
      <div className="contents" style={themeStyle}>
      <TipForm
        accent={safeAccent(storedAccent)}
        sounds={sounds}
        rules={rules}
        voiceMinPaise={voiceMinPaise}
        handle={handle}
        displayName={displayName}
        pictureUrl={creator.picture_url}
        bannerUrl={bannerUrl}
        ytChannelName={creator.yt_channel_name}
        ytChannelUrl={creator.yt_channel_url}
        minTipPaise={MIN_TIP_PAISE}
        messageMaxChars={creator.message_max_chars}
        bio={creator.bio}
        alertMode={creator.alert_mode}
        birthdayOffered={birthdayOffered}
        pinOffer={pinOffer}
        previewMode={creator.creator_status !== "active"}
      />
      </div>
    </PageShell>
  );
}
