import "server-only";
import { getDb } from "@/lib/db";
import { setLearnedWords, unknownHinglishWords } from "@/lib/hinglish";

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

// The words the daily job learned (migration 0022), handed to the converter. Kept
// for 10 minutes per server instance so a tip does not wait on the database; a
// removal in /admin/tts-words takes effect within that time.
let loadedAt = 0;
export async function loadLearnedWords(): Promise<void> {
  if (Date.now() - loadedAt < 10 * 60 * 1000) return;
  loadedAt = Date.now();
  const db = getDb();
  if (!db) return;
  try {
    const rows = await db<{ word: string; devanagari: string }[]>`select word, devanagari from tts_learned_words`;
    setLearnedWords(rows.map((r) => [r.word, r.devanagari] as const));
  } catch {
    // Migration 0022 not run yet: the hand-written dictionary alone.
  }
}
