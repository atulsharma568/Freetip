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
}

// React.cache deduplicates this across generateMetadata and the page component
// within the same request, so we hit the database only once.
export const getCreator = cache(async (handle: string): Promise<CreatorRow | null> => {
  const db = getDb();
  if (!db) return null;
  const rows = await db<CreatorRow[]>`
    select google_id, display_name, name, picture_url, yt_channel_name, yt_channel_url,
           creator_status, min_tip_paise, message_max_chars, bio
    from users
    where handle = ${handle}
  `;
  return rows[0] ?? null;
});
