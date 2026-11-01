import type { PlanFeatures } from "@/lib/plans";
import { NO_FEATURES, planFeatures } from "@/lib/plans";
import { parseBannedWords } from "@/lib/message-filter";
import { pickMedia, type AlertMedia, type MediaCandidate } from "@/lib/media";

// Everything an alert carries besides the fan's name, amount and message: the sound,
// the voice choice, the creator's banned words and (as the paid features ship) media,
// theme, fan level, birthday, voice note and highlight. The overlay route used to look
// these up one after another; they are now read together, each piece on its own so a
// column from a migration that has not been run only drops that piece, never the alert.
//
// The pure half (`resolveAlertExtras`) decides what is shown, so a feature that is
// switched off at play time drops its extras and the plain card plays, and it is
// testable without a database. The query half (`loadAlertExtras`) only reads.

export type Sql = <T extends object[]>(strings: TemplateStringsArray, ...values: unknown[]) => Promise<T> & PromiseLike<T>;

export type AlertSound = { url: string; volume: number; ms: number };

export type AlertExtras = {
  // The fan chose "read my message aloud".
  voiceRequested: boolean;
  bannedWords: string[];
  sound: AlertSound | null;
  // The creator's GIF, image or WebM for this alert (custom alert media); null while
  // the feature is off, the creator has no playable file or this is the message card.
  media: AlertMedia | null;
  // Filled in by their features; null while that feature is off or not built.
  theme: null;
  level: null;
  birthday: null;
  voiceNote: null;
  highlight: null;
};

export type RawExtras = {
  voiceRequested: boolean;
  bannedWords: string[];
  sound: AlertSound | null;
  // The creator's uploaded files (all of them; only playable ones are used).
  media?: readonly MediaCandidate[];
};

export function resolveAlertExtras(
  raw: RawExtras,
  ctx: { kind: "alert" | "message"; features: PlanFeatures; tipId?: number },
): AlertExtras {
  return {
    voiceRequested: raw.voiceRequested,
    bannedWords: raw.bannedWords,
    // A voice tip has no sound at all, not even the default; only the alert card has
    // one, not the follow-up message card.
    sound: ctx.kind === "alert" && !raw.voiceRequested ? raw.sound : null,
    // A voice tip may still show media (only its sound is dropped). Only the alert
    // card has media, and only while the creator's switch is on at play time.
    media:
      ctx.kind === "alert" && ctx.features.customAlertMedia ? pickMedia(raw.media ?? [], ctx.tipId ?? 0) : null,
    theme: null,
    level: null,
    birthday: null,
    voiceNote: null,
    highlight: null,
  };
}

async function safely<T>(label: string, fallback: T, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    console.error(`Overlay: could not look up ${label}.`, err);
    return fallback;
  }
}

export async function loadAlertExtras(
  db: Sql,
  o: { tipId: number; creatorId: number; kind: "alert" | "message" },
): Promise<AlertExtras> {
  const [voiceRequested, bannedWords, sound, features] = await Promise.all([
    // Whether the fan chose "read my message aloud" (migration 0014).
    safely("the voice choice", false, async () => {
      const [found] = await db<{ tts_requested: boolean }[]>`
        select tts_requested from tip_orders where id = ${o.tipId}
      `;
      return !!found?.tts_requested;
    }),
    // The creator's banned words (migration 0016); without them nothing is blocked.
    safely("the banned words", [] as string[], async () => {
      const [found] = await db<{ banned_words: string }[]>`
        select banned_words from users where id = ${o.creatorId}
      `;
      return parseBannedWords(found?.banned_words);
    }),
    // The fan's sound pick (even if the creator hid or repriced it afterwards),
    // otherwise the creator's default. Missing sounds table (migration 0013) means
    // a silent alert. Skipped for the message card, which never has a sound.
    o.kind === "alert"
      ? safely("the alert sound", null as AlertSound | null, async () => {
          const [found] = await db<{ blob_url: string; volume: number; duration_ms: number }[]>`
            select s.blob_url, s.volume, s.duration_ms
            from tip_orders t
            join users u on u.id = t.creator_id
            join creator_sounds s on s.id = coalesce(t.sound_id, u.default_sound_id)
                                 and s.creator_id = u.id
            where t.id = ${o.tipId}
          `;
          return found ? { url: found.blob_url, volume: found.volume, ms: found.duration_ms } : null;
        })
      : Promise.resolve(null as AlertSound | null),
    // The creator's switches, checked now (play time), not when the fan paid.
    safely("the creator's features", NO_FEATURES, async () => {
      const [found] = await db<{ paid_features: string[] | null }[]>`
        select paid_features from users where id = ${o.creatorId}
      `;
      return planFeatures(found);
    }),
  ]);

  // The creator's files (migration 0036), read only when the feature is on for them.
  const media =
    o.kind === "alert" && features.customAlertMedia
      ? await safely("the alert media", [] as MediaCandidate[], async () => {
          const rows = await db<
            {
              id: string;
              kind: MediaCandidate["kind"];
              blob_url: string;
              placement: MediaCandidate["placement"];
              duration_ms: number | null;
              enabled: boolean;
              review_state: MediaCandidate["review_state"];
            }[]
          >`
            select id::text, kind, blob_url, placement, duration_ms, enabled, review_state
            from creator_media
            where creator_id = ${o.creatorId} and enabled and review_state = 'approved'
            order by id
          `;
          return rows.map((r) => ({ ...r, id: Number(r.id) }));
        })
      : [];

  return resolveAlertExtras(
    { voiceRequested, bannedWords, sound, media },
    { kind: o.kind, features, tipId: o.tipId },
  );
}
