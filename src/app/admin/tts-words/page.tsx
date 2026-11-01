import Link from "next/link";
import { ActionForm } from "@/components/admin/ActionForm";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { buttonClass } from "@/components/admin/tones";
import { removeLearnedWord, reviewTtsWord } from "@/app/actions/admin";
import { fmtIST } from "@/lib/admin/format";
import { load } from "@/lib/admin/result";
import { adminDb } from "@/lib/admin/server-db";
import { requireOwner } from "@/lib/owner-auth";
import { CouldNotRead, DatabaseNotSetUp } from "../_components/Notices";
import { PageHeader } from "../_components/PageHeader";

export const dynamic = "force-dynamic";

type LearnedRow = {
  word: string;
  devanagari: string;
  created_at: Date;
};

type WordRow = {
  word: string;
  seen: number;
  last_seen: Date;
};

const LIMIT = 300;

// Words in Hindi-looking tip messages that the Hinglish converter does not know,
// most common first. Add the Hindi ones to src/lib/hinglish-words.ts, then mark
// them reviewed.
export default async function AdminTtsWordsPage() {
  await requireOwner();
  const db = adminDb();

  const [learned, words] = db
    ? await Promise.all([
        load("the learned words", async () => {
          const rows = await db<LearnedRow[]>`
            select word, devanagari, created_at from tts_learned_words order by created_at desc limit ${LIMIT}
          `;
          const [c] = await db<{ n: string }[]>`select count(*)::text as n from tts_learned_words`;
          return { rows, total: Number(c.n) };
        }),
        load("the unknown words", async () => {
          const rows = await db<WordRow[]>`
            select word, seen, last_seen from tts_unknown_words
            where not reviewed order by seen desc, last_seen desc limit ${LIMIT}
          `;
          const [c] = await db<{ n: string }[]>`select count(*)::text as n from tts_unknown_words where not reviewed`;
          return { rows, total: Number(c.n) };
        }),
      ])
    : [null, null];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Voice words"
        title="Words the voice does not know"
        note="Hindi-looking words in tip messages that the Hinglish converter could not convert, most common first. Add the Hindi ones to the dictionary, then mark them reviewed; English words can be marked reviewed as they are."
      />

      {!words ? (
        <DatabaseNotSetUp />
      ) : !words.ok ? (
        <CouldNotRead
          message="Could not read the unknown words. Has db/migrations/0021_tts_unknown_words.sql been run in Neon?"
          detail={words.error}
        />
      ) : words.data.rows.length === 0 ? (
        <AdminEmptyState
          title="No new words"
          description="Words the Hinglish converter does not know appear here once Hindi-looking tips are spoken."
        />
      ) : (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="text-sm text-muted">
              Showing {words.data.rows.length} of {words.data.total} unknown word{words.data.total === 1 ? "" : "s"}.
            </p>
            <Link href="/admin/tts-words/export" prefetch={false} className={buttonClass("quiet", "sm")}>
              Download list
            </Link>
          </div>
          <div className="max-h-[75vh] overflow-auto rounded-surface border border-control">
            <table className="w-full text-sm">
              <caption className="sr-only">Unknown words, most seen first</caption>
              <thead className="sticky top-0 z-10 bg-raised">
                <tr className="border-b border-control">
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Word</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Seen</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Last seen</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-control bg-surface">
                {words.data.rows.map((w) => (
                  <tr key={w.word} className="align-top hover:bg-raised">
                    <td className="px-4 py-3 font-medium text-text">{w.word}</td>
                    <td className="numeric px-4 py-3 text-muted">{w.seen}</td>
                    <td className="numeric px-4 py-3 text-muted">{fmtIST(w.last_seen, "date")}</td>
                    <td className="px-4 py-3">
                      <ActionForm
                        action={reviewTtsWord.bind(null, w.word)}
                        label="Mark reviewed"
                        pendingLabel="Saving…"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {learned &&
        (!learned.ok ? (
          <p className="text-sm text-muted">
            Learned words could not be read. Voice auto-learning is parked, so migration 0022 may simply not have been
            run. <span className="break-words font-mono text-xs">{learned.error}</span>
          </p>
        ) : (
          learned.data.rows.length > 0 && (
            <section className="space-y-3">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-text">Learned by the voice</h2>
                <p className="text-sm text-muted">
                  Showing {learned.data.rows.length} of {learned.data.total} word{learned.data.total === 1 ? "" : "s"}{" "}
                  added automatically (a language model proposed them, our rules accepted them). They convert only inside Hindi
                  sentences. Remove any that sound wrong.
                </p>
              </div>
              <div className="max-h-[75vh] overflow-auto rounded-surface border border-control">
                <table className="w-full text-sm">
                  <caption className="sr-only">Words the voice learned by itself</caption>
                  <thead className="sticky top-0 z-10 bg-raised">
                    <tr className="border-b border-control">
                      <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Word</th>
                      <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Hindi</th>
                      <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Learned</th>
                      <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-control bg-surface">
                    {learned.data.rows.map((l) => (
                      <tr key={l.word} className="align-top hover:bg-raised">
                        <td className="px-4 py-3 font-medium text-text">{l.word}</td>
                        <td className="px-4 py-3 text-text">{l.devanagari}</td>
                        <td className="numeric px-4 py-3 text-muted">{fmtIST(l.created_at, "date")}</td>
                        <td className="px-4 py-3">
                          <ActionForm
                            action={removeLearnedWord.bind(null, l.word)}
                            label="Remove"
                            pendingLabel="Removing…"
                            tone="danger"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )
        ))}
    </div>
  );
}
