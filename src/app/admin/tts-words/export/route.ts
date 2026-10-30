import { getDb } from "@/lib/db";
import { requireOwner } from "@/lib/owner-auth";

// The unreviewed unknown words as a plain file, one "word,seen" per line, to paste
// into an editor or a prompt when extending the Hinglish dictionary.
export async function GET() {
  await requireOwner();
  const db = getDb();
  if (!db) return new Response("Not set up", { status: 503 });

  try {
    const rows = await db<{ word: string; seen: number }[]>`
      select word, seen from tts_unknown_words where not reviewed order by seen desc, word limit 2000
    `;
    const body = "word,seen\n" + rows.map((r) => `${r.word},${r.seen}`).join("\n") + "\n";
    return new Response(body, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="voice-words.csv"',
        "cache-control": "no-store",
      },
    });
  } catch {
    return new Response("Run migration 0021 first", { status: 503 });
  }
}
