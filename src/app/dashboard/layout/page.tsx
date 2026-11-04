import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { hasFeature } from "@/lib/plans";
import { SITE_NAME } from "@/lib/site";
import { safeAccent } from "@/lib/accent";
import { safeFont, safeTheme } from "@/lib/overlay-themes";
import { baseColours, resolveAlertText } from "@/lib/alert-text";
import { resolveAlertLayout } from "@/lib/alert-layout";
import type { AlertMedia, MediaKind } from "@/lib/media";
import { OVERLAY_FONT_CLASSES } from "@/components/overlay/fonts";
import { DashboardNav } from "../DashboardNav";
import { AlertSubNav } from "../AlertSubNav";
import { DashboardShell } from "../parts/DashboardShell";
import { LayoutManager } from "./LayoutManager";

export const metadata: Metadata = {
  title: `Alert layout: ${SITE_NAME}`,
  robots: { index: false },
};

export default async function AlertLayoutPage() {
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
  if (!user?.handle || !hasFeature(user, "alertLayout")) redirect("/dashboard");
  const mediaOn = hasFeature(user, "customAlertMedia");

  // The saved layout sits in a column from migration 0047; before it is run the page still
  // opens, on the normal alert, and saving says so.
  let saved: unknown = null;
  try {
    const [row] = await db<{ alert_layout: unknown }[]>`select alert_layout from users where id = ${user.id}`;
    saved = row?.alert_layout ?? null;
  } catch (err) {
    console.error("Layout page: could not read the saved layout (migration 0047 run?).", err);
  }

  // The preview wears the creator's card style and text too, only for the features that are on
  // (migrations 0037 and 0044), and their first picture if they have one, so it is the card the
  // stream shows.
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
      console.error("Layout page: could not read the card style (migration 0037 run?).", err);
    }
  }
  let text = null;
  if (hasFeature(user, "alertText")) {
    try {
      const [row] = await db<{ alert_text: unknown }[]>`select alert_text from users where id = ${user.id}`;
      text = resolveAlertText(row?.alert_text ?? null, baseColours(theme, user.accent));
    } catch (err) {
      console.error("Layout page: could not read the alert text (migration 0044 run?).", err);
    }
  }
  let media: AlertMedia | null = null;
  if (mediaOn) {
    try {
      const [row] = await db<{ blob_url: string; kind: MediaKind; duration_ms: number | null }[]>`
        select blob_url, kind, duration_ms from creator_media
        where creator_id = ${user.id} and review_state <> 'removed' order by created_at, id limit 1
      `;
      if (row) media = { url: row.blob_url, kind: row.kind, placement: "above", durationMs: row.duration_ms };
    } catch (err) {
      console.error("Layout page: could not read the media (migration 0036 run?).", err);
    }
  }

  return (
    <DashboardShell handle={user.handle} live={user.creator_status === "active"}>
      <div className="mx-auto w-full max-w-3xl space-y-8 px-6 pb-24 pt-4 lg:max-w-6xl">
        <div className="space-y-4">
          <DashboardNav current="layout" />
          <AlertSubNav current="layout" />
          <h1 className="display text-[clamp(2.25rem,8vw,3.5rem)]">Alert volume and layout</h1>
          <p className="text-pretty text-base text-muted">
            Turn the alert sounds and the spoken voice down to suit your stream, and put the picture
            beside the card instead of above it. Volume can only go down from normal, never above it.
          </p>
        </div>

        <LayoutManager
          saved={resolveAlertLayout(saved)}
          accent={safeAccent(user.accent)}
          theme={safeTheme(theme)}
          font={safeFont(font)}
          text={text}
          media={media}
          mediaOn={mediaOn}
          fontClasses={OVERLAY_FONT_CLASSES}
        />
      </div>
    </DashboardShell>
  );
}
