import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { hasFeature } from "@/lib/plans";
import { SITE_NAME } from "@/lib/site";
import { safeAccent } from "@/lib/accent";
import { safeFont, safeTheme } from "@/lib/overlay-themes";
import { baseColours, resolveAlertText } from "@/lib/alert-text";
import { MAX_VARIATIONS_PER_CREATOR } from "@/lib/alert-variations";
import type { AlertMedia, MediaKind, MediaPlacement } from "@/lib/media";
import { OVERLAY_FONT_CLASSES } from "@/components/overlay/fonts";
import { DashboardNav } from "../DashboardNav";
import { DashboardShell } from "../parts/DashboardShell";
import { VariationsManager, type VariationRow } from "./VariationsManager";

export const metadata: Metadata = {
  title: `Alert variations: ${SITE_NAME}`,
  robots: { index: false },
};

export default async function VariationsPage() {
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
  if (!user?.handle || !hasFeature(user, "alertVariations")) redirect("/dashboard");
  const mediaOn = hasFeature(user, "customAlertMedia");
  const textOn = hasFeature(user, "alertText");

  // The table is from migration 0046; before it is run the page still opens, empty, and
  // saving says it could not save.
  let saved: { id: string; min_paise: number; media_id: string | null; sound_id: string | null; text: unknown; stay_seconds: number | null }[] = [];
  try {
    saved = await db`
      select id::text, min_paise, media_id::text, sound_id::text, text, stay_seconds
      from alert_variations where creator_id = ${user.id} order by min_paise
    `;
  } catch (err) {
    console.error("Variations page: could not read the variations (migration 0046 run?).", err);
  }

  const [sounds, media] = await Promise.all([
    db<{ id: string; name: string; emoji: string | null }[]>`
      select id::text, name, emoji from creator_sounds where creator_id = ${user.id} order by created_at, id
    `,
    mediaOn
      ? db<{ id: string; name: string; review_state: string; blob_url: string; kind: MediaKind; placement: MediaPlacement; duration_ms: number | null }[]>`
          select id::text, name, review_state, blob_url, kind, placement, duration_ms from creator_media
          where creator_id = ${user.id} and review_state <> 'removed' order by created_at, id
        `
      : Promise.resolve([] as { id: string; name: string; review_state: string; blob_url: string; kind: MediaKind; placement: MediaPlacement; duration_ms: number | null }[]),
  ]);

  // The preview wears the creator's card style and standard text, only for the features that are
  // on (migrations 0037 and 0044), so it is the card the stream shows.
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
      console.error("Variations page: could not read the card style (migration 0037 run?).", err);
    }
  }
  const base = baseColours(theme, user.accent);
  let standard = null;
  if (textOn) {
    try {
      const [row] = await db<{ alert_text: unknown }[]>`select alert_text from users where id = ${user.id}`;
      standard = resolveAlertText(row?.alert_text ?? null, base);
    } catch (err) {
      console.error("Variations page: could not read the alert text (migration 0044 run?).", err);
    }
  }

  const soundName = new Map(sounds.map((s) => [Number(s.id), `${s.emoji ? `${s.emoji} ` : ""}${s.name}`]));
  const mediaById = new Map(media.map((m) => [Number(m.id), m]));
  const rows: VariationRow[] = saved.map((r) => ({
    id: Number(r.id),
    minRupees: Math.ceil(r.min_paise / 100),
    mediaId: r.media_id === null ? null : Number(r.media_id),
    mediaName: r.media_id === null ? null : (mediaById.get(Number(r.media_id))?.name ?? "A file that is no longer available"),
    soundId: r.sound_id === null ? null : Number(r.sound_id),
    soundName: r.sound_id === null ? null : (soundName.get(Number(r.sound_id)) ?? "A sound that is no longer available"),
    text: resolveAlertText(r.text, base),
    staySeconds: r.stay_seconds,
  }));
  const mediaOptions = media.map((m) => ({
    id: Number(m.id),
    label: m.review_state === "new" ? `${m.name} (waiting for approval)` : m.name,
    media: { url: m.blob_url, kind: m.kind, placement: m.placement, durationMs: m.duration_ms } satisfies AlertMedia,
  }));

  return (
    <DashboardShell handle={user.handle} live={user.creator_status === "active"}>
      <div className="mx-auto w-full max-w-3xl space-y-8 px-6 pb-24 pt-4">
        <div className="space-y-4">
          <DashboardNav current="variations" />
          <h1 className="display text-[clamp(2.25rem,8vw,3.5rem)]">Alert variations</h1>
          <p className="text-pretty text-base text-muted">
            From a tip size up, the alert changes by itself: your chosen picture or video, sound,
            wording and colours, and for ₹1,000 or more a longer stay. The biggest size at or below the
            tip is used. A fan&rsquo;s own choice always wins: a tip that picked an alert rule gets no
            variation, a soundboard sound the fan chose replaces the variation&rsquo;s sound, and a spoken
            message plays without any sound.
          </p>
        </div>

        <VariationsManager
          rows={rows}
          sounds={sounds.map((s) => ({ id: Number(s.id), label: soundName.get(Number(s.id)) ?? s.name }))}
          media={mediaOptions}
          mediaOn={mediaOn}
          textOn={textOn}
          standardText={standard}
          accent={safeAccent(user.accent)}
          theme={safeTheme(theme)}
          font={safeFont(font)}
          fontClasses={OVERLAY_FONT_CLASSES}
          max={MAX_VARIATIONS_PER_CREATOR}
        />
      </div>
    </DashboardShell>
  );
}
