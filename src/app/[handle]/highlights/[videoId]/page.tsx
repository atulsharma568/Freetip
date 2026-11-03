import { isOwnerTipPage, ownerBrand } from "@/lib/owner-page";
import { cache, type CSSProperties } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { PageShell } from "@/components/PageShell";
import { RevealHeading } from "@/components/motion/RevealHeading";
import { RollText } from "@/components/motion/RollText";
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
      { id: string; google_id: string; display_name: string | null; name: string | null; creator_status: string; paid_features: string[] | null; ts_public: boolean }[]
    >`select id::text, google_id, display_name, name, creator_status, paid_features, ts_public from users where handle = ${handle}`;
    if (!creator || isClosedGoogleId(creator.google_id)) return null;
    if (creator.creator_status !== "active" || !creator.ts_public || !planFeatures(creator).highlightsPage) return null;
    const stream = await loadStreamHighlights(db as unknown as LedgerDb, Number(creator.id), videoId);
    if (!stream || stream.groups.length === 0) return null;
    return {
      name: isOwnerTipPage(handle, creator.google_id) ? ownerBrand() : (creator.display_name ?? creator.name ?? handle),
      stream,
    };
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

  // A long name would overflow the pill on a narrow phone.
  const shortName = name.length > 22 ? `${name.slice(0, 21)}…` : name;
  const tag = "rounded-full border border-line px-2 py-0.5 text-xs font-medium text-muted";

  return (
    <PageShell slim>
      <div className="contents" style={themeStyle}>
        <div className="mx-auto w-full max-w-2xl space-y-10 px-4 py-12 sm:px-6">
          <div className="space-y-3">
            <p className="enter numeric text-sm text-muted">
              {SITE_HOST}/{handle}
            </p>
            <h1 className="rise display text-[clamp(2.25rem,8vw,3.5rem)]">{stream.title || "Stream highlights"}</h1>
            <p className="enter text-muted" style={{ "--i": 1 } as CSSProperties}>
              {stream.groups.length} {stream.groups.length === 1 ? "moment" : "moments"} from {name}&apos;s stream.
              Each time opens the video at that second. Links open YouTube in a new tab.
            </p>
          </div>

          <div className="space-y-4">
            <RevealHeading className="display text-[clamp(1.75rem,5vw,2.25rem)]">Jump to a moment</RevealHeading>
            <ol className="divide-y divide-line/60 overflow-hidden rounded-[var(--radius-surface)] border border-line/60 bg-surface">
              {stream.groups.map((g, i) => (
                <li key={g.seconds} className="rise" style={{ "--i": Math.min(i, 12) } as CSSProperties}>
                  <a
                    href={youtubeMomentLink(videoId, g.seconds)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-4 px-4 py-4 transition-colors duration-200 hover:bg-ground/60 sm:px-5"
                  >
                    <span className="numeric w-16 shrink-0 text-accent">{formatOffset(g.seconds)}</span>
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="min-w-0 break-words text-text">
                        {g.titles.length ? g.titles.join(" / ") : "Moment"}
                      </span>
                      {g.sources.includes("tip") && <span className={tag}>tip</span>}
                      {g.sources.includes("goal") && <span className={tag}>goal</span>}
                    </span>
                    <ArrowUpRight
                      weight="bold"
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted transition-[transform,color] duration-300 ease-out-expo group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent group-focus-visible:text-accent"
                    />
                    <span className="sr-only"> (opens YouTube in a new tab)</span>
                  </a>
                </li>
              ))}
            </ol>
          </div>

          <div className="enter space-y-4 rounded-[var(--radius-surface)] border border-line/60 bg-surface p-5 sm:p-6">
            <p className="text-text">Enjoyed the stream?</p>
            <Link
              href={`/${handle}`}
              className="beam inline-flex h-14 items-center gap-3 rounded-full border border-line px-8 text-base font-semibold text-text"
            >
              <RollText>{`Tip ${shortName}`}</RollText>
            </Link>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
