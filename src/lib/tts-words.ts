import "server-only";
import { getDb } from "@/lib/db";
import { unknownHinglishWords } from "@/lib/hinglish";

// Keeps a count of the words the Hinglish converter does not know (migration 0021)
// so the owner can improve the dictionary. Never throws: a missing table or a
// database error must not stop a tip alert from being spoken.
export async function recordUnknownWords(message: string): Promise<void> {
  const words = unknownHinglishWords(message);
  const db = getDb();
  if (!db || !words.length) return;
  try {
    await db`
      insert into tts_unknown_words (word)
      select unnest(${words}::text[])
      on conflict (word) do update
        set seen = tts_unknown_words.seen + 1, last_seen = now()
    `;
  } catch {
    // Migration 0021 not run yet.
  }
}
