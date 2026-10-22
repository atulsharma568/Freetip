import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { PageShell } from "@/components/PageShell";
import { TipForm } from "./TipForm";
import { SITE_NAME, SITE_HOST } from "@/lib/site";
import { HANDLE_PATTERN } from "@/lib/waitlist";

interface CreatorRow {
  name: string | null;
  picture_url: string | null;
  yt_channel_name: string | null;
  yt_channel_url: string | null;
  creator_status: "pending" | "active" | "suspended";
  min_tip_paise: number;
  message_max_chars: number;
}

// React.cache deduplicates this across generateMetadata and the page component
// within the same request, so we hit the database only once.
const getCreator = cache(async (handle: string): Promise<CreatorRow | null> => {
  const db = getDb();
  if (!db) return null;
  const rows = await db<CreatorRow[]>`
    select name, picture_url, yt_channel_name, yt_channel_url,
           creator_status, min_tip_paise, message_max_chars
    from users
    where handle = ${handle}
  `;
  return rows[0] ?? null;
});

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  if (!HANDLE_PATTERN.test(handle)) return { title: SITE_NAME };

  const creator = await getCreator(handle);
  if (!creator || creator.creator_status !== "active") {
    return { title: `${handle} | ${SITE_NAME}` };
  }

  const displayName = creator.name ?? handle;
  return {
    title: `Tip ${displayName} | ${SITE_NAME}`,
    description: `Send a tip to ${displayName} on ${SITE_NAME}. No fan account or email needed.`,
  };
}

export default async function CreatorPage({ params }: Props) {
  const { handle } = await params;
  if (!HANDLE_PATTERN.test(handle)) notFound();

  const creator = await getCreator(handle);
  if (!creator) notFound();

  if (creator.creator_status !== "active") {
    return (
      <PageShell>
        <NotReady handle={handle} name={creator.name} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <TipForm
        name={creator.name ?? handle}
        pictureUrl={creator.picture_url}
        ytChannelName={creator.yt_channel_name}
        ytChannelUrl={creator.yt_channel_url}
        minTipPaise={creator.min_tip_paise}
        messageMaxChars={creator.message_max_chars}
      />
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
