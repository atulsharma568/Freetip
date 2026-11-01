import { createHash } from "crypto";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { getDb } from "@/lib/db";
import type { LedgerDb } from "@/lib/accrual";
import { loadRecentHighlights } from "@/lib/highlights";
import { planFeatures } from "@/lib/plans";
import { SITE_NAME } from "@/lib/site";
import { TOKEN_PATTERN } from "@/lib/stream-timestamps";
import { buildChapters, formatOffset, youtubeMomentLink } from "@/lib/timestamps";
import { CopyChapters } from "./CopyChapters";

// The creator's private page for their video editor: every saved moment of their latest
// streams, the ones several people marked first, a CSV, and chapters to paste into the
// video description. Read only, no sign-in, found by the secret in the address. No viewer
// names. Never indexed.
export const metadata: Metadata = {
  title: `Stream moments: ${SITE_NAME}`,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function EditorPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN_PATTERN.test(token)) notFound();
  const db = getDb();
  if (!db) notFound();

  const hash = createHash("sha256").update(token).digest("hex");
  let creator: { id: string; name: string; plan: string | null } | undefined;
  let streams: Awaited<ReturnType<typeof loadRecentHighlights>> = [];
  try {
    [creator] = await db<{ id: string; name: string; plan: string | null }[]>`
      select id::text, coalesce(display_name, name, handle, 'the creator') as name, plan
        from users where ts_editor_token_hash = ${hash} and creator_status <> 'suspended'
    `;
    if (creator && planFeatures(creator.plan).editorLink) {
      streams = await loadRecentHighlights(db as unknown as LedgerDb, Number(creator.id));
    } else {
      creator = undefined;
    }
  } catch (err) {
    console.error("Editor page: could not load (migration 0033 run?).", err);
    notFound();
  }
  if (!creator) notFound();

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-3xl space-y-8 px-6 py-12">
        <div className="space-y-3">
          <h1 className="display text-[clamp(2rem,8vw,3rem)]">Moments from {creator.name}&apos;s streams</h1>
          <p className="text-muted">
            Saved by viewers and by the stream itself. A moment several people marked shows a count: those are
            usually the ones worth cutting. This page updates as the stream goes on.
          </p>
        </div>

        {streams.length === 0 && <p className="text-sm text-muted">No moments saved yet.</p>}

        {streams.map((s) => {
          const chapters = buildChapters(s.groups);
          return (
            <section key={s.videoId} className="space-y-4 rounded-[var(--radius-surface)] border border-line/60 bg-surface p-6">
              <div className="space-y-1">
                <h2 className="text-lg font-medium text-text">{s.title || s.videoId}</h2>
                <a
                  href={`https://youtu.be/${s.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="numeric text-xs text-muted underline-offset-4 hover:underline"
                >
                  youtu.be/{s.videoId}
                </a>
              </div>

              {s.groups.length === 0 ? (
                <p className="text-sm text-muted">Times show once the stream has started on YouTube.</p>
              ) : (
                <>
                  <ul className="divide-y divide-line/60">
                    {[...s.groups]
                      .map((g, i) => ({ g, i }))
                      .sort((a, b) => b.g.marks - a.g.marks || a.i - b.i)
                      .map(({ g }) => (
                        <li key={g.seconds} className="flex items-baseline gap-4 py-3 text-sm">
                          <a
                            href={youtubeMomentLink(s.videoId, g.seconds)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="numeric w-16 shrink-0 text-accent underline-offset-4 hover:underline"
                          >
                            {formatOffset(g.seconds)}
                          </a>
                          <span className="min-w-0 flex-1 text-text">
                            {g.titles.length ? g.titles.join(" / ") : "Moment"}
                            {g.sources.includes("tip") && <span className="ml-2 text-xs text-muted">tip</span>}
                            {g.sources.includes("goal") && <span className="ml-2 text-xs text-muted">goal</span>}
                          </span>
                          {g.marks > 1 && <span className="shrink-0 text-xs text-muted">{g.marks} marked</span>}
                        </li>
                      ))}
                  </ul>
                  <div className="flex flex-wrap items-center gap-3 border-t border-line/60 pt-4">
                    <a
                      href={`/editor/${token}/csv?video=${s.videoId}`}
                      className="inline-flex h-11 items-center rounded-full border border-control px-5 text-sm text-text transition-colors hover:border-accent"
                    >
                      Download CSV
                    </a>
                    <CopyChapters text={chapters.ok ? chapters.text : null} reason={chapters.ok ? null : chapters.reason} />
                  </div>
                </>
              )}
            </section>
          );
        })}
      </div>
    </PageShell>
  );
}
