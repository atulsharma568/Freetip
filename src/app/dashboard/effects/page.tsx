import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { isOwnerTipPage } from "@/lib/owner-page";
import { ownerPageDoc } from "@/lib/page-doc/defaults";
import { themeFor } from "@/lib/page-doc/theme";
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
  const [user] = await db<{ id: number; handle: string | null; creator_status: string; picture_url: string | null; name: string | null }[]>`
    select id, handle, creator_status, picture_url, name from users where google_id = ${googleId}
  `;
  // Only the owner's own page has these for now.
  if (!user?.handle || !isOwnerTipPage(user.handle, googleId)) redirect("/dashboard");

  // Until something is saved, the page shows what the owner's page document says (the Clutch pulse banner).
  const header = ownerPageDoc().blocks.find((b) => b.type === "header");
  const start = header && header.type === "header" ? header.settings : null;
  const saved = await readTipDecor(user.id);
  const current = saved ?? {
    frame: start && start.frame !== "custom" ? start.frame : "none",
    bannerFx: start && start.bannerFx !== "custom" ? start.bannerFx : "none",
  };

  return (
    <DashboardShell handle={user.handle} live={user.creator_status === "active"}>
      <div className="mx-auto w-full max-w-3xl space-y-8 px-6 pb-24 pt-4">
        <div className="space-y-4">
          <DashboardNav current="decor" />
          <h1 className="display text-[clamp(2.25rem,8vw,3.5rem)]">Photo and banner effects</h1>
          <p className="text-pretty text-base text-muted">
            Pick an animated frame for your photo and an animated effect for your banner. Tap a look to see it on the preview, then
            press Save and it is live on your tip page straight away. You can change or switch it off any time.
          </p>
        </div>

        <EffectsManager
          saved={current}
          style={themeFor(ownerPageDoc(), null).style ?? {}}
          pictureUrl={user.picture_url}
          name={user.name ?? "You"}
        />
      </div>
    </DashboardShell>
  );
}
