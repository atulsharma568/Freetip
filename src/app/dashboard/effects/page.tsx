import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { isOwnerTipPage } from "@/lib/owner-page";
import { defaultPageDoc, ownerPageDoc } from "@/lib/page-doc/defaults";
import { themeFor } from "@/lib/page-doc/theme";
import { hasFeature } from "@/lib/plans";
import { mayPickTipDecor } from "@/lib/page-doc/decor";
import { safePhotoUrl } from "@/lib/tip-banner";
import { readTipDecor } from "@/lib/tip-decor-store";
import { SITE_NAME } from "@/lib/site";
import { DashboardNav } from "../DashboardNav";
import { DashboardShell } from "../parts/DashboardShell";
import { EffectsManager } from "./EffectsManager";

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
  const current = saved ?? {
    avatar: start ? start.avatar : "none",
    frame: start && start.frame !== "custom" ? start.frame : "none",
    bannerFx: start && start.bannerFx !== "custom" ? start.bannerFx : "none",
  };

  // The photo the tip page and the dashboard show: the YouTube channel photo while the banner switch is on.
  let channelPhoto: string | null = null;
  try {
    const [row] = await db<{ paid_features: string[] | null; tip_photo_url: string | null }[]>`
      select paid_features, tip_photo_url from users where id = ${user.id}
    `;
    if (row && hasFeature(row, "tipBanner")) channelPhoto = safePhotoUrl(row.tip_photo_url);
  } catch (err) {
    console.error("Effects: could not read the channel photo.", err);
  }

  return (
    <DashboardShell handle={user.handle} live={user.creator_status === "active"}>
      <div className="mx-auto w-full max-w-3xl space-y-8 px-6 pb-24 pt-4 lg:max-w-6xl">
        <div className="space-y-4">
          <DashboardNav current="decor" />
          <h1 className="display text-[clamp(2.25rem,8vw,3.5rem)]">Photo and banner effects</h1>
          <p className="text-pretty text-base text-muted">
            Pick a profile picture, an animated frame over it and an animated effect for your banner. Tap a look to see it on the preview, then
            press Save and it is live on your tip page straight away. You can change or switch it off any time.
          </p>
        </div>

        <EffectsManager
          saved={current}
          style={themeFor(baseDoc, ownerPage ? null : user.accent).style ?? {}}
          pictureUrl={channelPhoto ?? user.picture_url}
          name={user.name ?? "You"}
        />
      </div>
    </DashboardShell>
  );
}
