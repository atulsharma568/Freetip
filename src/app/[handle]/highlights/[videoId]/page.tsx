import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { accentStyle } from "@/lib/accent";
import { isClosedGoogleId } from "@/lib/account-close";
import { getDb } from "@/lib/db";
import type { LedgerDb } from "@/lib/accrual";
import { loadStreamHighlights } from "@/lib/highlights";
import { planFeatures } from "@/lib/plans";
import { SITE_HOST, SITE_NAME } from "@/lib/site";
import { formatOffset, isVideoId, youtubeMomentLink } from "@/lib/timestamps";
import { HANDLE_PATTERN } from "@/lib/waitlist";
import { getCreatorAccent } from "../../creator";

// A stream's saved moments as a public page: each time is a link that opens the stream
// there, with a button to tip the creator. Only when the creator switched public pages on
// (and has the feature). Times and labels only, never a viewer's name.

type Props = { params: Promise<{ handle: string; videoId: string }> };

const load = cache(async (handle: string, videoId: string) => {
  if (!HANDLE_PATTERN.test(handle) || !isVideoId(videoId)) return null;
  const db = getDb();
  if (!db) return null;
  try {
    const [creator] = await db<
      { id: string; google_id: string; display_name: string | null; name: string | null; creator_status: string; plan: string | null; ts_public: boolean }[]
    >`select id::text, google_id, display_name, name, creator_status, plan, ts_public from users where handle = ${handle}`;
    if (!creator || isClosedGoogleId(creator.google_id)) return null;
    if (creator.creator_status !== "active" || !creator.ts_public || !planFeatures(creator.plan).highlightsPage) return null;
    const stream = await loadStreamHighlights(db as unknown as LedgerDb, Number(creator.id), videoId);
    if (!stream || stream.groups.length === 0) return null;
    return { name: creator.display_name ?? creator.name ?? handle, stream };
  } catch (err) {
    console.error("Highlights page: could not load (migration 0033 run?).", err);
    return null;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle, videoId } = await params;
  const data = await load(handle, videoId);
  if (!data) return { title: SITE_NAME, robots: { index: false } };
  const title = `${data.stream.title || "Stream highlights"}: ${data.name} | ${SITE_NAME}`;
  const description = `${data.stream.groups.length} moments from ${data.name}'s stream, each one a link to that second.`;
  const url = `/${handle}/highlights/${videoId}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
    twitter: { title, description },
    // Thin pages stay out of search results.
    robots: { index: data.stream.groups.length >= 3 },
  };
}

export default async function HighlightsPage({ params }: Props) {
  const { handle, videoId } = await params;
  const data = await load(handle, videoId);
  if (!data) notFound();
  const themeStyle = accentStyle(await getCreatorAccent(handle));
  const { stream, name } = data;

  return (
    <PageShell>
      <div className="contents" style={themeStyle}>
        <div className="mx-auto w-full max-w-2xl space-y-8 px-6 py-12">
          <div className="space-y-3">
            <p className="numeric text-sm text-muted">
              {SITE_HOST}/{handle}
            </p>
            <h1 className="display text-[clamp(2rem,8vw,3rem)]">{stream.title || "Stream highlights"}</h1>
            <p className="text-muted">
              {stream.groups.length} {stream.groups.length === 1 ? "moment" : "moments"} from {name}&apos;s stream.
              Each time opens the video at that second.
            </p>
          </div>

          <ol className="divide-y divide-line/60 rounded-[var(--radius-surface)] border border-line/60 bg-surface">
            {stream.groups.map((g) => (
              <li key={g.seconds}>
                <a
                  href={youtubeMomentLink(videoId, g.seconds)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-baseline gap-4 px-5 py-4 transition-colors duration-200 hover:bg-ground/60"
                >
                  <span className="numeric w-16 shrink-0 text-accent">{formatOffset(g.seconds)}</span>
                  <span className="min-w-0 text-text">
                    {g.titles.length ? g.titles.join(" / ") : "Moment"}
                    {g.sources.includes("tip") && <span className="ml-2 text-xs text-muted">tip</span>}
                    {g.sources.includes("goal") && <span className="ml-2 text-xs text-muted">goal</span>}
                  </span>
                </a>
              </li>
            ))}
          </ol>

          <div className="space-y-3 rounded-[var(--radius-surface)] border border-line/60 bg-surface p-6">
            <p className="text-text">Enjoyed the stream?</p>
            <Link
              href={`/${handle}`}
              className="inline-flex h-12 items-center rounded-full bg-accent px-6 text-sm font-semibold text-ink transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              Tip {name}
            </Link>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
