import Link from "next/link";
import { getDb } from "@/lib/db";
import { reviewTtsWord } from "@/app/actions/admin";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { requireOwner } from "@/lib/owner-auth";

interface WordRow {
  word: string;
  seen: number;
  last_seen: string;
}

// Words in Hindi-looking tip messages that the Hinglish converter does not know,
// most common first. Add the Hindi ones to src/lib/hinglish-words.ts, then mark
// them reviewed.
export default async function AdminTtsWordsPage() {
  await requireOwner();
  const db = getDb();

  let words: WordRow[] = [];
  let missing = false;
  if (db) {
    try {
      words = await db<WordRow[]>`
        select word, seen, last_seen from tts_unknown_words
        where not reviewed order by seen desc, last_seen desc limit 300
      `;
    } catch {
      missing = true;
    }
  }

  if (missing) {
    return (
      <AdminEmptyState
        title="Voice words are not set up"
        description="Run db/migrations/0021_tts_unknown_words.sql in Neon to start logging unknown words."
      />
    );
  }
  if (!words.length) {
    return (
      <AdminEmptyState
        title="No new words"
        description="Words the Hinglish converter does not know appear here once Hindi-looking tips are spoken."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-text">Voice words</h1>
          <p className="text-sm text-muted">
            {words.length} unknown word{words.length !== 1 ? "s" : ""} in Hindi-looking tips. Add the Hindi ones to the
            dictionary, then mark them reviewed. English words can be marked reviewed as they are.
          </p>
        </div>
        <Link
          href="/admin/tts-words/export"
          prefetch={false}
          className="rounded-lg border border-control px-3 py-2 text-sm text-muted hover:text-text"
        >
          Download list
        </Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-control">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-control bg-surface/60">
              <th className="px-4 py-3 text-left font-medium text-muted">Word</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Seen</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Last seen</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-control">
            {words.map((w) => (
              <tr key={w.word} className="bg-surface/30 hover:bg-surface/60">
                <td className="px-4 py-3 font-medium text-text">{w.word}</td>
                <td className="numeric px-4 py-3 text-muted">{w.seen}</td>
                <td className="numeric px-4 py-3 text-muted">{new Date(w.last_seen).toLocaleDateString("en-IN")}</td>
                <td className="px-4 py-3">
                  <form action={reviewTtsWord.bind(null, w.word)}>
                    <button
                      type="submit"
                      className="rounded-lg border border-control px-3 py-1 text-xs font-medium text-muted hover:text-text"
                    >
                      Mark reviewed
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
