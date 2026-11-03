import { cache } from "react";
import { getDb } from "@/lib/db";
import { hasFeature } from "@/lib/plans";
import { MIN_TIP_PAISE } from "@/lib/money";
import { playable, type MediaKind, type ReviewState } from "@/lib/media";
import { pinOffer, type PinOffer } from "@/lib/pinned";
import { safeBannerUrl } from "@/lib/tip-banner";

export interface CreatorRow {
  google_id: string;
  display_name: string | null;
  name: string | null;
  picture_url: string | null;
  yt_channel_name: string | null;
  yt_channel_url: string | null;
  creator_status: "pending" | "active" | "suspended";
  min_tip_paise: number;
  message_max_chars: number;
  bio: string | null;
  tts_enabled: boolean;
  tts_min_paise: number;
  alert_mode: "instant" | "split" | "approve";
}

// React.cache deduplicates this across generateMetadata and the page component
// within the same request, so we hit the database only once.
export const getCreator = cache(async (handle: string): Promise<CreatorRow | null> => {
  const db = getDb();
  if (!db) return null;
  const rows = await db<CreatorRow[]>`
    select google_id, display_name, name, picture_url, yt_channel_name, yt_channel_url,
           creator_status, min_tip_paise, message_max_chars, bio,
           tts_enabled, tts_min_paise, alert_mode
    from users
    where handle = ${handle}
  `;
  return rows[0] ?? null;
});

export interface TipSound {
  id: number;
  name: string;
  emoji: string;
  minPaise: number;
  url: string;
}

// The sounds fans may pick. Empty when the creator has none, and also when the
// sounds table (migration 0013) does not exist yet, so the tip page keeps working.
export const getTipSounds = cache(async (handle: string): Promise<TipSound[]> => {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db<{ id: number; name: string; emoji: string | null; min_paise: number; blob_url: string }[]>`
      select s.id, s.name, s.emoji, s.min_paise, s.blob_url
      from creator_sounds s
      join users u on u.id = s.creator_id
      where u.handle = ${handle} and s.enabled
      order by s.min_paise, s.created_at, s.id
    `;
    return rows.map((r) => ({
      id: Number(r.id),
      name: r.name,
      emoji: r.emoji ?? "",
      minPaise: r.min_paise,
      url: r.blob_url,
    }));
  } catch {
    return [];
  }
});

// The accent colour (migration 0026), read apart so the tip page still loads
// before the migration is run.
export const getCreatorAccent = cache(async (handle: string): Promise<string | null> => {
  const db = getDb();
  if (!db) return null;
  try {
    const rows = await db<{ accent: string | null }[]>`select accent from users where handle = ${handle}`;
    return rows[0]?.accent ?? null;
  } catch (err) {
    console.error("Tip page: could not read the accent colour.", err);
    return null;
  }
});

// The creator's YouTube banner for the top of the tip page: the paid switch is on and the saved
// address is one of Google's image hosts. Read apart (migrations 0035 and 0048) so the page
// still loads before they are run.
export const getTipBanner = cache(async (handle: string): Promise<string | null> => {
  const db = getDb();
  if (!db) return null;
  try {
    const [row] = await db<{ paid_features: string[] | null; tip_banner_url: string | null }[]>`
      select paid_features, tip_banner_url from users where handle = ${handle}
    `;
    return row && hasFeature(row, "tipBanner") ? safeBannerUrl(row.tip_banner_url) : null;
  } catch {
    return null;
  }
});

// Whether the tip page offers a pinned message, and on what terms: the creator has the paid
// highlighted messages switch on and has set a minimum tip. Read apart (migrations 0035 and
// 0040) so the page still loads before they are run.
export const getPinOffer = cache(async (handle: string): Promise<PinOffer | null> => {
  const db = getDb();
  if (!db) return null;
  try {
    const [row] = await db<
      { paid_features: string[] | null; highlight_min_paise: number | null; highlight_seconds: number | null }[]
    >`
      select paid_features, highlight_min_paise, highlight_seconds
      from users where handle = ${handle}
    `;
    return row && hasFeature(row, "highlightedMessages") ? pinOffer(row) : null;
  } catch {
    return null;
  }
});

// One of the creator's picks on the tip page: a GIF, picture or video and/or a sound
// that goes with a fixed tip amount. Tapping it sets the amount and plays the sound.
export interface TipRule {
  id: number;
  minPaise: number;
  // What the fan sees; null when the rule is only a sound or a longer stay.
  media: { url: string; kind: MediaKind; name: string } | null;
  sound: { url: string; name: string } | null;
  // Seconds the alert stays on screen (a big-tip rule), shown on the tile; null is the normal length.
  staySeconds: number | null;
}

// The picks fans may tap: the creator has alert rules on and the rule does something.
// Only rules at or above the site minimum can be a fixed amount. A file that is held,
// switched off or removed is left off the tile, and a rule with nothing left is not shown.
// Read apart (migrations 0036 and 0043) so the tip page still loads before they are run.
export const getTipRules = cache(async (handle: string): Promise<TipRule[]> => {
  const db = getDb();
  if (!db) return [];
  try {
    const [owner] = await db<{ paid_features: string[] | null }[]>`
      select paid_features from users where handle = ${handle}
    `;
    if (!owner || !hasFeature(owner, "alertRules")) return [];
    const mediaOn = hasFeature(owner, "customAlertMedia");
    const rows = await db<
      {
        id: string;
        min_paise: number;
        stay_seconds: number | null;
        media_url: string | null;
        media_kind: MediaKind | null;
        media_name: string | null;
        media_enabled: boolean | null;
        media_state: ReviewState | null;
        sound_url: string | null;
        sound_name: string | null;
      }[]
    >`
      select r.id::text, r.min_paise, r.stay_seconds,
             m.blob_url as media_url, m.kind as media_kind, m.name as media_name,
             m.enabled as media_enabled, m.review_state as media_state,
             s.blob_url as sound_url, s.name as sound_name
      from alert_rules r
      join users u on u.id = r.creator_id
      left join creator_media m on m.id = r.media_id and m.creator_id = r.creator_id
      left join creator_sounds s on s.id = r.sound_id and s.creator_id = r.creator_id
      where u.handle = ${handle} and r.min_paise >= ${MIN_TIP_PAISE}
      order by r.min_paise
      limit 10
    `;
    const rules: TipRule[] = [];
    for (const r of rows) {
      const media =
        mediaOn && r.media_url && r.media_kind && r.media_state && playable({ enabled: !!r.media_enabled, review_state: r.media_state })
          ? { url: r.media_url, kind: r.media_kind, name: r.media_name ?? "Alert" }
          : null;
      const sound = r.sound_url ? { url: r.sound_url, name: r.sound_name ?? "Sound" } : null;
      if (!media && !sound && r.stay_seconds === null) continue;
      rules.push({ id: Number(r.id), minPaise: r.min_paise, media, sound, staySeconds: r.stay_seconds });
    }
    return rules;
  } catch {
    return [];
  }
});
