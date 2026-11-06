import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { isOwnerTipPage } from "@/lib/owner-page";
import { defaultPageDoc, ownerPageDoc } from "@/lib/page-doc/defaults";
import { themeFor } from "@/lib/page-doc/theme";
import { hasFeature } from "@/lib/plans";
import { FRAME_SCALE, isFileFx, mayPickTipDecor, type PresetEffect, type TipDecor } from "@/lib/page-doc/decor";
import { safeBannerUrl, safePhotoUrl } from "@/lib/tip-banner";
import { readTipDecor } from "@/lib/tip-decor-store";
import { SITE_NAME } from "@/lib/site";
import { DashboardNav } from "../DashboardNav";
import { DashboardShell } from "../parts/DashboardShell";
import { EffectsManager } from "./EffectsManager";
import { MusicUpload } from "./MusicUpload";
import { readPageMusic } from "@/lib/page-music-store";

export const metadata: Metadata = {
  title: `Photo and banner effects: ${SITE_NAME}`,
  robots: { index: false },
};

export default async function EffectsPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const googleId = (session.user as { googleId?: string }).googleId;
  const db = getDb();
  if (!db || !googleId) redirect("/dashboard");
  const [user] = await db<{ id: number; handle: string | null; creator_status: string; picture_url: string | null; name: string | null; paid_features: string[] | null; accent: string | null }[]>`
    select id, handle, creator_status, picture_url, name, paid_features, accent from users where google_id = ${googleId}
  `;
  // The owner's own page, or a creator the owner has switched "Photo frame and banner effects" on for.
  const ownerPage = Boolean(user?.handle) && isOwnerTipPage(user!.handle!, googleId);
  if (!user?.handle || !mayPickTipDecor(ownerPage, user)) redirect("/dashboard");

  // Until something is saved, the page shows what the page document says (for the owner, the Clutch
  // pulse banner; for a creator, nothing).
  const baseDoc = ownerPage ? ownerPageDoc() : defaultPageDoc();
  const header = baseDoc.blocks.find((b) => b.type === "header");
  const start = header && header.type === "header" ? header.settings : null;
  const saved = await readTipDecor(user.id);
  const startFx = start && start.bannerFx !== "custom" ? start.bannerFx : "none";
  const current: TipDecor = saved ?? {
    avatar: start ? start.avatar : "none",
    frame: start && start.frame !== "custom" ? start.frame : "none",
    bannerFx: isFileFx(startFx) ? "none" : (startFx as PresetEffect),
    bannerPic: isFileFx(startFx) ? startFx : "none",
    avatarUpload: null,
    frameUpload: null,
    frameScale: FRAME_SCALE.standard,
  };

  // The photo the tip page and the dashboard show: the YouTube channel photo while the banner switch is on.
  let channelPhoto: string | null = null;
  // The saved banner (when the banner switch is on), so the preview and the upload tile show the real one.
  let banner: string | null = null;
  let bannerOn = false;
  try {
    const [row] = await db<{ paid_features: string[] | null; tip_photo_url: string | null; tip_banner_url: string | null }[]>`
      select paid_features, tip_photo_url, tip_banner_url from users where id = ${user.id}
    `;
    if (row && hasFeature(row, "tipBanner")) {
      bannerOn = true;
      channelPhoto = safePhotoUrl(row.tip_photo_url);
      banner = safeBannerUrl(row.tip_banner_url);
    }
  } catch (err) {
    console.error("Effects: could not read the channel photo and banner.", err);
  }

  // The owner's page music (migration 0061); owner only.
  const music = ownerPage ? await readPageMusic(user.id) : null;

  return (
    <DashboardShell handle={user.handle} live={user.creator_status === "active"}>
      <div className="mx-auto w-full max-w-3xl space-y-8 px-6 pb-24 pt-4 lg:max-w-6xl">
        <div className="space-y-4">
          <DashboardNav current="decor" />
          <h1 className="display text-[clamp(2.25rem,8vw,3.5rem)]">Photo and banner effects</h1>
          <p className="text-pretty text-base text-muted">
            Pick or upload a profile picture, a decoration over it, a banner and an effect that plays over the banner. Tap a look to see it on the preview, then
            press Save and it is live on your tip page straight away. You can change or switch it off any time.
          </p>
        </div>

        <EffectsManager
          saved={current}
          style={themeFor(baseDoc, ownerPage ? null : user.accent).style ?? {}}
          pictureUrl={channelPhoto ?? user.picture_url}
          name={user.name ?? "You"}
          bannerUrl={banner}
          creatorId={user.id}
          uploadsReady={!!process.env.BLOB_READ_WRITE_TOKEN}
          canUploadBanner={bannerOn}
        />
        {ownerPage && <MusicUpload creatorId={user.id} music={music} uploadsReady={!!process.env.BLOB_READ_WRITE_TOKEN} />}
      </div>
    </DashboardShell>
  );
}
