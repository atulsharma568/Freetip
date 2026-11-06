import { getDb } from "@/lib/db";
import { parsePageMusic, type PageMusic } from "@/lib/page-music";

// The owner's track, from the column added by migration 0061. Null when none is saved, the database
// is not set up or the column is not there yet, so the tip page and the dashboard never break over it.
export async function readPageMusic(creatorId: number): Promise<PageMusic | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const [row] = await db<{ page_music: unknown }[]>`select page_music from users where id = ${creatorId}`;
    return parsePageMusic(row?.page_music, creatorId);
  } catch (err) {
    console.error("Could not read the page music (migration 0061 run?).", err);
    return null;
  }
}
