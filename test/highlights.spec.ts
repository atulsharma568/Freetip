import { expect, test } from "@playwright/test";
import { loadRecentHighlights, loadStreamHighlights } from "../src/lib/highlights";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// What the editor page, the CSV and the public highlights page read, against the real
// schema (in-memory Postgres): the creator's own streams only, times from the start, and
// never a viewer's name.

async function setup() {
  const pg = await freshDatabase();
  const make = async (n: number) =>
    Number((await pg.query<{ id: string }>(
      `insert into users (google_id, email, handle, creator_status) values ($1, $2, $3, 'active') returning id::text`,
      [`g${n}`, `c${n}@example.com`, `handle${n}`],
    )).rows[0].id);
  return { pg, a: await make(1), b: await make(2) };
}

const stream = (pg: Awaited<ReturnType<typeof freshDatabase>>, video: string, creator: number, started: string | null) =>
  pg.query(`insert into timestamp_streams (video_id, creator_id, title, started_at) values ($1, $2, 'Ranked', $3)`, [video, creator, started]);

const moment = (pg: Awaited<ReturnType<typeof freshDatabase>>, video: string, creator: number, at: string, title: string, user: string | null, source = "chat", delay = 22) =>
  pg.query(
    `insert into stream_timestamps (creator_id, video_id, chat_user, title, source, delay_seconds, created_at)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [creator, video, user, title, source, delay, at],
  );

test("groups the moments by time from the stream's start, with no viewer names", async () => {
  const { pg, a } = await setup();
  await stream(pg, "abcDEF12345", a, "2026-11-01T10:00:00Z");
  await moment(pg, "abcDEF12345", a, "2026-11-01T10:12:56Z", "clutch", "Ravi Kumar");
  await moment(pg, "abcDEF12345", a, "2026-11-01T10:13:00Z", "clutch", "Asha");
  await moment(pg, "abcDEF12345", a, "2026-11-01T10:30:00Z", "₹500 tip", null, "tip", 0);

  const h = await loadStreamHighlights(asLedgerDb(pg), a, "abcDEF12345");
  expect(h).toMatchObject({ videoId: "abcDEF12345", title: "Ranked", state: "queued" });
  expect(h?.groups).toEqual([
    { seconds: 754, titles: ["clutch"], marks: 2, sources: ["chat"] },
    { seconds: 1800, titles: ["₹500 tip"], marks: 1, sources: ["tip"] },
  ]);
  expect(JSON.stringify(h)).not.toMatch(/Ravi|Asha/);
});

test("another creator cannot read a stream, and an unknown start gives no times", async () => {
  const { pg, a, b } = await setup();
  await stream(pg, "abcDEF12345", a, "2026-11-01T10:00:00Z");
  await moment(pg, "abcDEF12345", a, "2026-11-01T10:12:56Z", "x", "v");
  expect(await loadStreamHighlights(asLedgerDb(pg), b, "abcDEF12345")).toBeNull();

  await stream(pg, "zzzDEF12345", a, null);
  await moment(pg, "zzzDEF12345", a, "2026-11-01T10:12:56Z", "x", "v");
  expect((await loadStreamHighlights(asLedgerDb(pg), a, "zzzDEF12345"))?.groups).toEqual([]);
});

test("the recent list is the creator's own, newest first, and capped", async () => {
  const { pg, a, b } = await setup();
  await stream(pg, "oldDEF12345", a, "2026-11-01T10:00:00Z");
  await pg.query(`update timestamp_streams set created_at = now() - interval '2 days' where video_id = 'oldDEF12345'`);
  await stream(pg, "newDEF12345", a, "2026-11-01T10:00:00Z");
  await stream(pg, "othDEF12345", b, "2026-11-01T10:00:00Z");
  const list = await loadRecentHighlights(asLedgerDb(pg), a, 10);
  expect(list.map((s) => s.videoId)).toEqual(["newDEF12345", "oldDEF12345"]);
  expect(await loadRecentHighlights(asLedgerDb(pg), a, 1)).toHaveLength(1);
});
