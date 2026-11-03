import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { hasFeature } from "@/lib/plans";
import { SITE_NAME } from "@/lib/site";
import { safeAccent } from "@/lib/accent";
import { safeFont, safeTheme } from "@/lib/overlay-themes";
import { baseColours, resolveAlertText } from "@/lib/alert-text";
import { OVERLAY_FONT_CLASSES } from "@/components/overlay/fonts";
import { DashboardNav } from "../DashboardNav";
import { AlertSubNav } from "../AlertSubNav";
import { DashboardShell } from "../parts/DashboardShell";
import { TextManager } from "./TextManager";

export const metadata: Metadata = {
  title: `Alert text: ${SITE_NAME}`,
  robots: { index: false },
};

export default async function AlertTextPage() {
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
  if (!user?.handle || !hasFeature(user, "alertText")) redirect("/dashboard");

  // The saved text sits in a column from migration 0044; before it is run the page still
  // opens, on the normal card, and saving says so. The card style and font only count while
  // that feature is on (migration 0037).
  let saved: unknown = null;
  try {
    const [row] = await db<{ alert_text: unknown }[]>`select alert_text from users where id = ${user.id}`;
    saved = row?.alert_text ?? null;
  } catch (err) {
    console.error("Text page: could not read the saved alert text (migration 0044 run?).", err);
  }
  let theme = "classic";
  let font = "default";
  if (hasFeature(user, "overlayThemes")) {
    try {
      const [row] = await db<{ overlay_theme: string; overlay_font: string }[]>`
        select overlay_theme, overlay_font from users where id = ${user.id}
      `;
      theme = safeTheme(row?.overlay_theme);
      font = safeFont(row?.overlay_font);
    } catch (err) {
      console.error("Text page: could not read the card style (migration 0037 run?).", err);
    }
  }

  return (
    <DashboardShell handle={user.handle} live={user.creator_status === "active"}>
      <div className="mx-auto w-full max-w-3xl space-y-8 px-6 pb-24 pt-4">
        <div className="space-y-4">
          <DashboardNav current="text" />
          <AlertSubNav current="text" />
          <h1 className="display text-[clamp(2.25rem,8vw,3.5rem)]">Alert text</h1>
          <p className="text-pretty text-base text-muted">
            Change the line above the amount and the colours of the alert card. Colours that would be
            hard to read on stream are refused. A tip that has not played yet shows with the new text,
            even if it was paid before you changed it.
          </p>
        </div>

        <TextManager
          saved={resolveAlertText(saved, baseColours(theme, user.accent))}
          accent={safeAccent(user.accent)}
          theme={safeTheme(theme)}
          font={safeFont(font)}
          fontClasses={OVERLAY_FONT_CLASSES}
        />
      </div>
    </DashboardShell>
  );
}
