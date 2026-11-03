import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { hasFeature } from "@/lib/plans";
import { SITE_NAME } from "@/lib/site";
import { safeAccent } from "@/lib/accent";
import { safeFont, safeTheme } from "@/lib/overlay-themes";
import { baseColours, resolveAlertText } from "@/lib/alert-text";
import { resolveAlertMotion } from "@/lib/alert-motion";
import { OVERLAY_FONT_CLASSES } from "@/components/overlay/fonts";
import { DashboardNav } from "../DashboardNav";
import { AlertSubNav } from "../AlertSubNav";
import { DashboardShell } from "../parts/DashboardShell";
import { MotionManager } from "./MotionManager";

export const metadata: Metadata = {
  title: `Alert motion: ${SITE_NAME}`,
  robots: { index: false },
};

export default async function AlertMotionPage() {
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
  if (!user?.handle || !hasFeature(user, "alertMotion")) redirect("/dashboard");

  // The saved motion sits in a column from migration 0045; before it is run the page still
  // opens, on the normal card, and saving says so.
  let saved: unknown = null;
  try {
    const [row] = await db<{ alert_motion: unknown }[]>`select alert_motion from users where id = ${user.id}`;
    saved = row?.alert_motion ?? null;
  } catch (err) {
    console.error("Motion page: could not read the saved alert motion (migration 0045 run?).", err);
  }

  // The preview wears the creator's card style and text too, only for the features that are on,
  // so it is the card the stream shows (migrations 0037 and 0044).
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
      console.error("Motion page: could not read the card style (migration 0037 run?).", err);
    }
  }
  let text = null;
  if (hasFeature(user, "alertText")) {
    try {
      const [row] = await db<{ alert_text: unknown }[]>`select alert_text from users where id = ${user.id}`;
      text = resolveAlertText(row?.alert_text ?? null, baseColours(theme, user.accent));
    } catch (err) {
      console.error("Motion page: could not read the alert text (migration 0044 run?).", err);
    }
  }

  return (
    <DashboardShell handle={user.handle} live={user.creator_status === "active"}>
      <div className="mx-auto w-full max-w-3xl space-y-8 px-6 pb-24 pt-4">
        <div className="space-y-4">
          <DashboardNav current="motion" />
          <AlertSubNav current="motion" />
          <h1 className="display text-[clamp(2.25rem,8vw,3.5rem)]">Alert motion</h1>
          <p className="text-pretty text-base text-muted">
            Choose how the alert card comes in and leaves, how long it stays and the pause before the
            next alert. The card always stays until the voice, sound or video has finished. If the
            computer running OBS asks for less motion, the card just fades.
          </p>
        </div>

        <MotionManager
          saved={resolveAlertMotion(saved)}
          accent={safeAccent(user.accent)}
          theme={safeTheme(theme)}
          font={safeFont(font)}
          text={text}
          fontClasses={OVERLAY_FONT_CLASSES}
        />
      </div>
    </DashboardShell>
  );
}
