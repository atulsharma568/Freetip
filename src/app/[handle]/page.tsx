import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getCreator, getCreatorAccent, getTipSounds } from "./creator";
import { auth } from "@/auth";
import { PageShell } from "@/components/PageShell";
import { accentStyle } from "@/lib/accent";
import { MIN_TIP_PAISE } from "@/lib/money";
import { isClosedGoogleId } from "@/lib/account-close";
import { TipForm } from "./TipForm";
import { SITE_NAME, SITE_HOST } from "@/lib/site";
import { HANDLE_PATTERN } from "@/lib/waitlist";
import { ttsAvailable } from "@/lib/tts";

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
      <PageShell>
        <NotReady handle={handle} name={creator.name} />
      </PageShell>
    );
  }

  const displayName = creator.display_name ?? creator.name ?? handle;
  const sounds = await getTipSounds(handle);
  // The voice is offered only when the site switch and the creator both have it on.
  const voiceMinPaise = ttsAvailable() && creator.tts_enabled ? creator.tts_min_paise : null;

  const themeStyle = accentStyle(await getCreatorAccent(handle));

  return (
    <PageShell>
      <div className="contents" style={themeStyle}>
      <TipForm
        sounds={sounds}
        voiceMinPaise={voiceMinPaise}
        handle={handle}
        displayName={displayName}
        pictureUrl={creator.picture_url}
        ytChannelName={creator.yt_channel_name}
        ytChannelUrl={creator.yt_channel_url}
        minTipPaise={MIN_TIP_PAISE}
        messageMaxChars={creator.message_max_chars}
        bio={creator.bio}
        alertMode={creator.alert_mode}
        previewMode={creator.creator_status !== "active"}
      />
      </div>
    </PageShell>
  );
}

function NotReady({ handle, name }: { handle: string; name: string | null }) {
  const displayName = name ?? handle;
  return (
    <div className="mx-auto w-full max-w-lg px-6 py-20 space-y-6">
      <p className="numeric text-sm text-muted">
        {SITE_HOST}/{handle}
      </p>
      <h1 className="display text-[clamp(2rem,8vw,3.5rem)]">Not live yet.</h1>
      <p className="text-pretty text-lg text-muted">
        {displayName}&apos;s tip page is being set up — check back soon.
      </p>
      <Link
        href="/"
        className="inline-flex h-12 items-center rounded-full bg-accent px-6 text-sm font-semibold text-ink transition-transform duration-150 ease-out active:scale-[0.97]"
      >
        Back to home
      </Link>
    </div>
  );
}
