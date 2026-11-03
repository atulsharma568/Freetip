import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { hasFeature } from "@/lib/plans";
import { SITE_NAME } from "@/lib/site";
import { safeAccent } from "@/lib/accent";
import { safeFont, safeTheme } from "@/lib/overlay-themes";
import { OVERLAY_FONT_CLASSES } from "@/components/overlay/fonts";
import { DashboardNav } from "../DashboardNav";
import { AlertSubNav } from "../AlertSubNav";
import { DashboardShell } from "../parts/DashboardShell";
import { StyleManager } from "./StyleManager";

export const metadata: Metadata = {
  title: `Alert style: ${SITE_NAME}`,
  robots: { index: false },
};

export default async function StylePage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const googleId = (session.user as { googleId?: string }).googleId;

  const db = getDb();
  if (!db || !googleId) redirect("/dashboard");
  const [user] = await db<
    { id: number; handle: string | null; creator_status: string; paid_features: string[] | null; accent: string | null }[]
  >`
    select id, handle, creator_status, paid_features, accent from users where google_id = ${googleId}
  `;
  if (!user?.handle || !hasFeature(user, "overlayThemes")) redirect("/dashboard");

  // The stored choice sits in columns from migration 0037; before it is run the page
  // still opens, on the defaults, and saving says so.
  let saved: { overlay_theme: string; overlay_font: string } | undefined;
  try {
    [saved] = await db<{ overlay_theme: string; overlay_font: string }[]>`
      select overlay_theme, overlay_font from users where id = ${user.id}
    `;
  } catch (err) {
    console.error("Style page: could not read the saved style (migration 0037 run?).", err);
  }

  return (
    <DashboardShell handle={user.handle} live={user.creator_status === "active"}>
      <div className="mx-auto w-full max-w-3xl space-y-8 px-6 pb-24 pt-4">
        <div className="space-y-4">
          <DashboardNav current="style" />
          <AlertSubNav current="style" />
          <h1 className="display text-[clamp(2.25rem,8vw,3.5rem)]">Alert style</h1>
          <p className="text-pretty text-base text-muted">
            Pick how the alert card looks on your stream. Your accent colour still colours it. A tip
            that has not played yet shows in the new style, even if it was paid before you changed it.
          </p>
        </div>

        <StyleManager
          savedTheme={safeTheme(saved?.overlay_theme)}
          savedFont={safeFont(saved?.overlay_font)}
          accent={safeAccent(user.accent)}
          fontClasses={OVERLAY_FONT_CLASSES}
        />
      </div>
    </DashboardShell>
  );
}
