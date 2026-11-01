import type { Query } from "./accrual";
import { groupMoments, offsetSeconds, type MomentGroup, type Source } from "./timestamps";

// What the editor page, the CSV and the public highlights page show for a stream: its
// title and its moments, grouped. Never a viewer's name. A stream whose start time is
// not known yet has no times to show.

export type StreamHighlights = {
  videoId: string;
  title: string | null;
  state: string;
  groups: MomentGroup[];
};

type Row = { created_at: Date; title: string | null; source: string; delay_seconds: number };

async function groupsFor(db: Query, videoId: string, startedAt: Date | null): Promise<MomentGroup[]> {
  if (!startedAt) return [];
  const rows = await db<Row[]>`
    select created_at, title, source, delay_seconds from stream_timestamps where video_id = ${videoId} order by created_at
  `;
  return groupMoments(
    rows.map((r) => ({
      seconds: offsetSeconds(r.created_at, startedAt, r.delay_seconds),
      title: r.title ?? "",
      user: "",
      source: (["chat", "tip", "goal"].includes(r.source) ? r.source : "chat") as Source,
    })),
  );
}

// One of the creator's streams, or null if it is not theirs.
export async function loadStreamHighlights(db: Query, creatorId: number, videoId: string): Promise<StreamHighlights | null> {
  const [s] = await db<{ title: string | null; state: string; started_at: Date | null }[]>`
    select title, state, started_at from timestamp_streams where video_id = ${videoId} and creator_id = ${creatorId}
  `;
  if (!s) return null;
  return { videoId, title: s.title, state: s.state, groups: await groupsFor(db, videoId, s.started_at) };
}

// The creator's latest streams, newest first, for the editor page.
export async function loadRecentHighlights(db: Query, creatorId: number, limit = 10): Promise<StreamHighlights[]> {
  const streams = await db<{ video_id: string; title: string | null; state: string; started_at: Date | null }[]>`
    select video_id, title, state, started_at from timestamp_streams
     where creator_id = ${creatorId} order by created_at desc limit ${limit}
  `;
  const out: StreamHighlights[] = [];
  for (const s of streams) {
    out.push({ videoId: s.video_id, title: s.title, state: s.state, groups: await groupsFor(db, s.video_id, s.started_at) });
  }
  return out;
}
