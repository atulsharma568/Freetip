import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { hasFeature } from "@/lib/plans";
import { SITE_NAME } from "@/lib/site";
import { accentStyle } from "@/lib/accent";
import { safeBannerUrl, safePhotoUrl } from "@/lib/tip-banner";
import { DashboardNav } from "../DashboardNav";
import { DashboardShell } from "../parts/DashboardShell";
import { BannerManager } from "./BannerManager";

export const metadata: Metadata = {
  title: `Tip page banner: ${SITE_NAME}`,
  robots: { index: false },
};

export default async function BannerPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const googleId = (session.user as { googleId?: string }).googleId;

  const db = getDb();
  if (!db || !googleId) redirect("/dashboard");
  const [user] = await db<
    {
      id: number;
      handle: string | null;
      creator_status: string;
      paid_features: string[] | null;
      accent: string | null;
      display_name: string | null;
      name: string | null;
      picture_url: string | null;
      yt_channel_name: string | null;
      yt_channel_url: string | null;
      bio: string | null;
    }[]
  >`
    select id, handle, creator_status, paid_features, accent, display_name, name, picture_url,
           yt_channel_name, yt_channel_url, bio
    from users where google_id = ${googleId}
  `;
  if (!user?.handle || !hasFeature(user, "tipBanner")) redirect("/dashboard");

  // The saved banner sits in a column from migration 0048; before it is run the page still
  // opens, with no banner, and saving says so.
  let saved: string | null = null;
  let savedPhoto: string | null = null;
  try {
    const [row] = await db<{ tip_banner_url: string | null }[]>`select tip_banner_url from users where id = ${user.id}`;
    saved = safeBannerUrl(row?.tip_banner_url);
  } catch (err) {
    console.error("Banner page: could not read the saved banner (migration 0048 run?).", err);
  }

  // The channel photo sits in a column from migration 0050, read apart for the same reason.
  try {
    const [row] = await db<{ tip_photo_url: string | null }[]>`select tip_photo_url from users where id = ${user.id}`;
    savedPhoto = safePhotoUrl(row?.tip_photo_url);
  } catch (err) {
    console.error("Banner page: could not read the saved photo (migration 0050 run?).", err);
  }

  return (
    <DashboardShell handle={user.handle} live={user.creator_status === "active"}>
      <div className="mx-auto w-full max-w-3xl space-y-8 px-6 pb-24 pt-4">
        <div className="space-y-4">
          <DashboardNav current="banner" />
          <h1 className="display text-[clamp(2.25rem,8vw,3.5rem)]">Tip page banner</h1>
          <p className="text-pretty text-base text-muted">
            Show a banner behind your photo at the top of your tip page: your YouTube channel banner, or
            a picture or animated GIF you upload. A YouTube banner is copied when you press the button,
            so press it again after you change it on YouTube.
          </p>
        </div>

        <BannerManager
          saved={saved}
          handle={user.handle}
          style={accentStyle(user.accent)}
          displayName={user.display_name ?? user.name ?? user.handle}
          pictureUrl={savedPhoto ?? user.picture_url}
          usingYouTubePhoto={!!savedPhoto}
          ytChannelName={user.yt_channel_name}
          ytChannelUrl={user.yt_channel_url}
          bio={user.bio}
          creatorId={user.id}
          uploadsReady={!!process.env.BLOB_READ_WRITE_TOKEN}
        />
      </div>
    </DashboardShell>
  );
}
