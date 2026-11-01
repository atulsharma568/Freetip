import { cache } from "react";
import { getDb } from "@/lib/db";

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
}

// React.cache deduplicates this across generateMetadata and the page component
// within the same request, so we hit the database only once.
export const getCreator = cache(async (handle: string): Promise<CreatorRow | null> => {
  const db = getDb();
  if (!db) return null;
  const rows = await db<CreatorRow[]>`
    select google_id, display_name, name, picture_url, yt_channel_name, yt_channel_url,
           creator_status, min_tip_paise, message_max_chars, bio,
           tts_enabled, tts_min_paise
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
