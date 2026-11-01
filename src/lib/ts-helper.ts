import type { LedgerDb } from "./accrual";
import { planFeatures } from "./plans";
import { hashToken, TOKEN_PATTERN } from "./stream-timestamps";
import { isVideoId, offsetSeconds } from "./timestamps";

// The feed behind the OBS clip helper (phase 3). The helper is a program on the
// creator's own PC. It asks here which moments were saved, and cuts each one out of the
// creator's own OBS recording. Only what it needs to cut and caption a clip is sent: no
// viewer names, and no Discord address (the creator types that into the helper itself).

export type HelperEvent = {
  id: number;
  source: "chat" | "tip" | "goal";
  videoId: string;
  // What was written, already cleaned (no links, no mentions). Empty if nothing.
  label: string;
  // Seconds into the stream, when the stream's start time is known.
  seconds: number | null;
  // How long ago the moment happened, by the database clock. The helper adds the time
  // since it received this, so no clock on the creator's PC has to match ours.
  ageSeconds: number;
};

export const MAX_EVENTS_PER_POLL = 20;
// How long one poll waits for news before answering with nothing.
export const POLL_WAIT_MS = 20_000;
export const POLL_STEP_MS = 2_000;

export type HelperCreator = { id: string; delaySeconds: number };

export type HelperLookup = { ok: true; creator: HelperCreator } | { ok: false };

// Whose helper this is. A wrong, suspended or ungated token is just "not found".
export async function findHelperCreator(db: LedgerDb, token: string): Promise<HelperLookup> {
  if (!TOKEN_PATTERN.test(token)) return { ok: false };
  const [row] = await db<{ id: string; delay: number; plan: string | null; creator_status: string }[]>`
    select id::text, ts_delay_seconds as delay, plan, creator_status
      from users where ts_helper_token_hash = ${hashToken(token)}
  `;
  if (!row || row.creator_status === "suspended" || !planFeatures(row.plan).clipHelper) return { ok: false };
  return { ok: true, creator: { id: row.id, delaySeconds: row.delay } };
}

// Notes that the helper is running, at most twice a minute.
export async function touchHelper(db: LedgerDb, creatorId: string): Promise<void> {
  await db`
    update users set ts_helper_seen_at = now()
     where id = ${creatorId} and (ts_helper_seen_at is null or ts_helper_seen_at < now() - interval '30 seconds')
  `;
}

// The newest saved moment's id: where a helper that has just started begins, so it does
// not cut clips for moments from before it ran.
export async function latestEventId(db: LedgerDb, creatorId: string): Promise<number> {
  const [row] = await db<{ id: string | null }[]>`select max(id)::text as id from stream_timestamps where creator_id = ${creatorId}`;
  return Number(row?.id ?? 0);
}

type EventRow = {
  id: string;
  source: HelperEvent["source"];
  video_id: string;
  title: string | null;
  created_at: Date;
  delay_seconds: number;
  started_at: Date | null;
  age: number;
};

// Moments saved after `since`, oldest first. The moment itself is when the command
// arrived minus the chat delay (a tip or goal has no delay): that is the instant to cut
// around in the creator's recording.
export async function loadHelperEvents(db: LedgerDb, creatorId: string, since: number): Promise<HelperEvent[]> {
  const rows = await db<EventRow[]>`
    select m.id::text, m.source, m.video_id, m.title, m.created_at, m.delay_seconds, s.started_at,
           extract(epoch from (now() - (m.created_at - make_interval(secs => m.delay_seconds))))::float8 as age
      from stream_timestamps m
      join timestamp_streams s on s.video_id = m.video_id
     where m.creator_id = ${creatorId} and m.id > ${since}
     order by m.id
     limit ${MAX_EVENTS_PER_POLL}
  `;
  return rows
    .filter((r) => isVideoId(r.video_id))
    .map((r) => ({
      id: Number(r.id),
      source: r.source,
      videoId: r.video_id,
      label: r.title ?? "",
      seconds: r.started_at ? offsetSeconds(r.created_at, r.started_at, r.delay_seconds) : null,
      ageSeconds: Math.max(0, Number(r.age)),
    }));
}

// The `since` the helper sent: a whole number from 0, or nothing for "I just started".
export function parseSince(raw: string | null): number | null {
  if (raw === null || raw === "") return null;
  if (!/^\d{1,15}$/.test(raw)) return null;
  return Number(raw);
}

// Seconds of replay buffer OBS needs so a clip can be cut: the chat delay, the 10 seconds
// after the moment that the helper waits for, the 20 before it, and 15 spare for the
// helper's own delays. The page shows this number to the creator.
export const CLIP_BEFORE_SECONDS = 20;
export const CLIP_AFTER_SECONDS = 10;
export const replayBufferNeeded = (delaySeconds: number) => Math.max(0, delaySeconds) + CLIP_AFTER_SECONDS + CLIP_BEFORE_SECONDS + 15;
