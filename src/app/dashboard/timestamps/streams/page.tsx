import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { SITE_NAME } from "@/lib/site";
import { planFeatures } from "@/lib/plans";
import { formatOffset, offsetSeconds, youtubeMomentLink } from "@/lib/timestamps";
import { DashboardNav } from "../../DashboardNav";
import { DashboardShell } from "../../parts/DashboardShell";
import { Tile } from "../../parts/Tile";
import { Msg } from "../../parts/Msg";
import { EmptyState } from "../../parts/EmptyState";
import { pillOutline } from "../../parts/styles";

export const metadata: Metadata = {
  title: `All streams: ${SITE_NAME}`,
  robots: { index: false },
};

const REASONS: Record<string, string> = {
  not_connected: "YouTube is not connected",
  reconnect: "reconnect YouTube",
  quota: "waiting for YouTube's daily limit",
  token: "YouTube sign-in problem, will retry",
  not_commentable: "comments are off on this video",
  not_allowed: "YouTube would not allow the comment",
  not_owner: "not your stream",
  never_live: "the stream never went live",
  unavailable: "video not available",
  no_timestamps: "no timestamps saved",
  unknown: "YouTube did not confirm, not retried",
  interrupted: "stopped half way, not retried",
};

type StreamRow = {
  video_id: string;
  title: string | null;
  state: string;
  reason: string | null;
  n: number;
  started_at: Date | null;
};
type MomentRow = { video_id: string; title: string | null; created_at: Date; delay_seconds: number };

// A page holds a few streams so nobody scrolls through a long list; the rest is on the next page.
const STREAMS_PER_PAGE = 3;
// Moments listed under one stream; a busier one says how many more there are.
const MOMENTS_SHOWN = 50;

const STATE_LABEL: Record<string, string> = {
  posted: "Posted",
  queued: "Waiting for the stream to end",
  posting: "Posting",
  skipped: "Skipped",
};

export default async function StreamsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const googleId = (session.user as { googleId?: string }).googleId;
  const db = getDb();
  if (!db || !googleId) redirect("/dashboard");

  const [user] = await db<
    { id: string; handle: string | null; paid_features: string[] | null; creator_status: string }[]
  >`
    select id::text, handle, paid_features, creator_status from users where google_id = ${googleId}
  `;
  if (!user?.handle) redirect("/dashboard");
  if (!planFeatures(user).timestamps) redirect("/dashboard");

  const requested = Number.parseInt((await searchParams).page ?? "1", 10);
  let page = Number.isInteger(requested) && requested > 0 ? requested : 1;

  let migrated = true;
  let total = 0;
  let isPublic = false;
  let streams: StreamRow[] = [];
  let moments: MomentRow[] = [];
  try {
    const [count] = await db<{ n: number }[]>`select count(*)::int as n from timestamp_streams where creator_id = ${user.id}`;
    total = count?.n ?? 0;
    page = Math.min(page, Math.max(1, Math.ceil(total / STREAMS_PER_PAGE)));
    streams = await db<StreamRow[]>`
      select s.video_id, s.title, s.state, s.reason, s.started_at,
             (select count(*)::int from stream_timestamps m where m.video_id = s.video_id) as n
        from timestamp_streams s where s.creator_id = ${user.id}
       order by s.created_at desc limit ${STREAMS_PER_PAGE} offset ${(page - 1) * STREAMS_PER_PAGE}
    `;
    if (streams.length) {
      moments = await db<MomentRow[]>`
        select video_id, title, created_at, delay_seconds
          from stream_timestamps
         where creator_id = ${user.id} and video_id in ${db(streams.map((s) => s.video_id))}
         order by created_at asc limit 500
      `;
    }
  } catch (err) {
    console.error("Streams page: could not read the data (migration 0032 run?).", err);
    migrated = false;
  }

  // Phase 2 column (migration 0033), read apart so the page works before it is run.
  try {
    const [row] = await db<{ is_public: boolean }[]>`select ts_public as is_public from users where id = ${user.id}`;
    isPublic = row.is_public;
  } catch (err) {
    console.error("Streams page: could not read the public switch (migration 0033 run?).", err);
  }

  const pages = Math.max(1, Math.ceil(total / STREAMS_PER_PAGE));
  const href = (p: number) => (p <= 1 ? "/dashboard/timestamps/streams" : `/dashboard/timestamps/streams?page=${p}`);

  return (
    <DashboardShell handle={user.handle} live={user.creator_status === "active"}>
      <div className="mx-auto w-full max-w-2xl space-y-8 px-6 pb-24 pt-4">
        <DashboardNav current="timestamps" />
        <div className="space-y-3">
          <h1 className="display text-[clamp(2.25rem,8vw,3.5rem)]">All streams</h1>
          <p className="text-muted">
            Every stream with saved moments, newest first. Open a time to jump to that second of the video.
          </p>
          <Link href="/dashboard/timestamps" className={pillOutline}>
            Back to timestamps
          </Link>
        </div>

        {!migrated ? (
          <Msg kind="error" text="Not ready yet: run db/migrations/0032_stream_timestamps.sql in Neon." />
        ) : total === 0 ? (
          <Tile id="all-streams" level={2} title="Streams">
            <EmptyState
              sample={
                <div className="flex items-start justify-between gap-4 rounded-field border border-line/60 bg-ground px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-text">Friday night stream</p>
                    <p className="text-xs text-muted">3 moments</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted">Posted</span>
                </div>
              }
              title="Nothing yet."
              body="Streams show up here after the first timestamp. The one above is a sample."
              cta={
                <Link href="/dashboard/timestamps#ts-command" className={pillOutline}>
                  Set up the chat command
                </Link>
              }
            />
          </Tile>
        ) : (
          <Tile id="all-streams" level={2} title="Streams">
            <ul className="divide-y divide-line/60">
              {streams.map((s) => {
                const list = moments.filter((m) => m.video_id === s.video_id);
                return (
                  <li key={s.video_id} className="flex items-start justify-between gap-4 py-4 text-sm">
                    <div className="min-w-0">
                      <a
                        href={`https://youtu.be/${s.video_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-text underline-offset-4 hover:underline"
                      >
                        {s.title || s.video_id}
                      </a>
                      <span className="text-xs text-muted">
                        {s.n} {s.n === 1 ? "moment" : "moments"}
                        {s.reason ? `, ${REASONS[s.reason] ?? s.reason}` : ""}
                      </span>
                      {s.started_at && (
                        <ul className="mt-2 space-y-1">
                          {list.slice(0, MOMENTS_SHOWN).map((m) => {
                            const at = offsetSeconds(m.created_at, s.started_at as Date, m.delay_seconds);
                            return (
                              <li key={`${m.created_at.getTime()}-${m.title}`} className="truncate text-xs">
                                <a
                                  href={youtubeMomentLink(s.video_id, at)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-text underline-offset-4 hover:underline"
                                >
                                  {formatOffset(at)}
                                </a>
                                {m.title ? <span className="text-muted"> {m.title}</span> : null}
                              </li>
                            );
                          })}
                          {list.length > MOMENTS_SHOWN && (
                            <li className="text-xs text-muted">and {list.length - MOMENTS_SHOWN} more</li>
                          )}
                        </ul>
                      )}
                    </div>
                    <span className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted">
                      {isPublic && s.n > 0 && (
                        <a
                          href={`/${user.handle}/highlights/${s.video_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-text underline-offset-4 hover:underline"
                        >
                          Public page
                        </a>
                      )}
                      {s.state in STATE_LABEL ? STATE_LABEL[s.state] : "Failed"}
                    </span>
                  </li>
                );
              })}
            </ul>

            {pages > 1 && (
              <nav aria-label="Pages of streams" className="flex items-center justify-between gap-4 pt-4 text-sm">
                {page > 1 ? (
                  <Link href={href(page - 1)} className={pillOutline}>
                    Newer
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-xs text-muted">
                  Page {page} of {pages}
                </span>
                {page < pages ? (
                  <Link href={href(page + 1)} className={pillOutline}>
                    Older
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            )}
          </Tile>
        )}
      </div>
    </DashboardShell>
  );
}
