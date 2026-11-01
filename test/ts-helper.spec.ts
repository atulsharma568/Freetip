import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import { hashToken } from "../src/lib/stream-timestamps";
import {
  CLIP_AFTER_SECONDS,
  CLIP_BEFORE_SECONDS,
  findHelperCreator,
  latestEventId,
  loadHelperEvents,
  MAX_EVENTS_PER_POLL,
  parseSince,
  replayBufferNeeded,
  touchHelper,
} from "../src/lib/ts-helper";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// The feed the OBS clip helper reads: who may read it, which moments it gets, in what
// order, and how old each one is. Run against the real schema (in-memory Postgres). The
// helper program itself is tested in tools/obs-clip-helper (npm test there).

// Tokens are exactly 43 characters; the number keeps each creator's different.
const tok = (letter: string, n: number) => (String(n).padStart(2, "0") + letter.repeat(43)).slice(0, 43);
const VIDEO = "abcDEF12345";
let seq = 0;

async function creator(pg: PGlite, over: { helper?: string | null; status?: string; delay?: number } = {}) {
  seq += 1;
  const r = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, creator_status, ts_token_hash, ts_editor_token_hash, ts_helper_token_hash, ts_delay_seconds)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id::text`,
    [
      `g${seq}`, `c${seq}@example.com`, `handle${seq}`, over.status ?? "active", hashToken(tok("c", seq)), hashToken(tok("e", seq)),
      over.helper === null ? null : hashToken(over.helper ?? tok("h", seq)), over.delay ?? 22,
    ],
  );
  return { id: Number(r.rows[0].id), token: tok("h", seq) };
}

async function stream(pg: PGlite, creatorId: number, video = VIDEO, startedAt: string | null = "2026-11-01 10:00:00+00") {
  await pg.query(`insert into timestamp_streams (video_id, creator_id, started_at) values ($1, $2, $3)`, [video, creatorId, startedAt]);
}

async function moment(pg: PGlite, creatorId: number, over: { video?: string; source?: string; title?: string; createdAt?: string; delay?: number } = {}) {
  const r = await pg.query<{ id: string }>(
    `insert into stream_timestamps (creator_id, video_id, chat_user, title, source, delay_seconds, created_at)
     values ($1, $2, 'Viewer', $3, $4, $5, coalesce($6::timestamptz, now())) returning id::text`,
    [creatorId, over.video ?? VIDEO, over.title ?? "Nice", over.source ?? "chat", over.delay ?? 22, over.createdAt ?? null],
  );
  return Number(r.rows[0].id);
}

test.describe("who may read the feed", () => {
  test("the helper's own token finds its creator and carries the delay", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg, { delay: 42 });
    expect(await findHelperCreator(asLedgerDb(pg), c.token)).toEqual({ ok: true, creator: { id: String(c.id), delaySeconds: 42 } });
  });

  test("a wrong, malformed, missing, chat-command or editor token is not found", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    const db = asLedgerDb(pg);
    expect(await findHelperCreator(db, "x".repeat(43))).toEqual({ ok: false });
    expect(await findHelperCreator(db, "short")).toEqual({ ok: false });
    expect(await findHelperCreator(db, tok("c", seq))).toEqual({ ok: false });
    expect(await findHelperCreator(db, tok("e", seq))).toEqual({ ok: false });
    await pg.query(`update users set ts_helper_token_hash = null where id = $1`, [c.id]);
    expect(await findHelperCreator(db, c.token)).toEqual({ ok: false });
  });

  test("a suspended creator's helper stops", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg, { status: "suspended" });
    expect(await findHelperCreator(asLedgerDb(pg), c.token)).toEqual({ ok: false });
  });

  test("two creators cannot use each other's tokens, and the same token cannot be stored twice", async () => {
    const pg = await freshDatabase();
    const a = await creator(pg);
    const b = await creator(pg);
    const db = asLedgerDb(pg);
    const foundA = await findHelperCreator(db, a.token);
    const foundB = await findHelperCreator(db, b.token);
    expect(foundA.ok && foundA.creator.id).toBe(String(a.id));
    expect(foundB.ok && foundB.creator.id).toBe(String(b.id));
    await expect(pg.query(`update users set ts_helper_token_hash = $1 where id = $2`, [hashToken(a.token), b.id])).rejects.toThrow();
  });

  test("the helper is noted as seen at most twice a minute", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    const db = asLedgerDb(pg);
    const seen = async () => (await pg.query<{ t: string | null }>(`select ts_helper_seen_at::text as t from users where id = $1`, [c.id])).rows[0].t;
    expect(await seen()).toBeNull();
    await touchHelper(db, String(c.id));
    const first = await seen();
    expect(first).not.toBeNull();
    await touchHelper(db, String(c.id));
    expect(await seen()).toBe(first);
    await pg.query(`update users set ts_helper_seen_at = now() - interval '2 minutes' where id = $1`, [c.id]);
    await touchHelper(db, String(c.id));
    expect(await seen()).not.toBe(first);
  });
});

test.describe("which moments it gets", () => {
  test("only this creator's, after `since`, oldest first, with the cleaned label", async () => {
    const pg = await freshDatabase();
    const a = await creator(pg);
    const b = await creator(pg);
    await stream(pg, a.id);
    await stream(pg, b.id, "zzzDEF12345");
    const one = await moment(pg, a.id, { title: "First" });
    await moment(pg, b.id, { video: "zzzDEF12345", title: "Not mine" });
    const two = await moment(pg, a.id, { title: "Second", source: "tip" });
    const three = await moment(pg, a.id, { title: "Third", source: "goal" });
    const db = asLedgerDb(pg);

    const all = await loadHelperEvents(db, String(a.id), 0);
    expect(all.map((e) => [e.id, e.label, e.source])).toEqual([[one, "First", "chat"], [two, "Second", "tip"], [three, "Third", "goal"]]);
    const later = await loadHelperEvents(db, String(a.id), one);
    expect(later.map((e) => e.id)).toEqual([two, three]);
    expect(await loadHelperEvents(db, String(a.id), three)).toEqual([]);
  });

  test("never carries a viewer's name", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    await stream(pg, c.id);
    await moment(pg, c.id);
    const [e] = await loadHelperEvents(asLedgerDb(pg), String(c.id), 0);
    expect(Object.keys(e).sort()).toEqual(["ageSeconds", "id", "label", "seconds", "source", "videoId"]);
    expect(JSON.stringify(e)).not.toContain("Viewer");
  });

  test("the moment is the arrival time minus the chat delay, so it is older than the command", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    await stream(pg, c.id);
    // Typed 40 s ago, chat runs 22 s behind: the moment itself was about 62 s ago.
    await moment(pg, c.id, { createdAt: new Date(Date.now() - 40_000).toISOString(), delay: 22 });
    // A tip alert has no delay: 5 s ago is 5 s ago.
    await moment(pg, c.id, { createdAt: new Date(Date.now() - 5_000).toISOString(), delay: 0, source: "tip" });
    const [chat, tip] = await loadHelperEvents(asLedgerDb(pg), String(c.id), 0);
    expect(chat.ageSeconds).toBeGreaterThan(61);
    expect(chat.ageSeconds).toBeLessThan(64);
    expect(tip.ageSeconds).toBeGreaterThan(4.5);
    expect(tip.ageSeconds).toBeLessThan(7);
  });

  test("seconds into the stream follow the saved start, and are null when it is not known", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    await stream(pg, c.id);
    await stream(pg, c.id, "nostart1234", null);
    // 12:56 after the start, minus a 22 s delay = 12:34 = 754 s.
    await moment(pg, c.id, { createdAt: "2026-11-01 10:12:56+00", delay: 22 });
    await moment(pg, c.id, { video: "nostart1234" });
    const [known, unknown] = await loadHelperEvents(asLedgerDb(pg), String(c.id), 0);
    expect(known.seconds).toBe(754);
    expect(unknown.seconds).toBeNull();
  });

  test("a poll returns at most the page size, and the next poll continues", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    await stream(pg, c.id);
    for (let i = 0; i < MAX_EVENTS_PER_POLL + 5; i++) await moment(pg, c.id, { title: `m${i}` });
    const db = asLedgerDb(pg);
    const first = await loadHelperEvents(db, String(c.id), 0);
    expect(first).toHaveLength(MAX_EVENTS_PER_POLL);
    const rest = await loadHelperEvents(db, String(c.id), first[first.length - 1].id);
    expect(rest).toHaveLength(5);
  });

  test("a new helper starts from the newest moment, not from the past", async () => {
    const pg = await freshDatabase();
    const a = await creator(pg);
    const b = await creator(pg);
    await stream(pg, a.id);
    const db = asLedgerDb(pg);
    expect(await latestEventId(db, String(a.id))).toBe(0);
    await moment(pg, a.id);
    const last = await moment(pg, a.id);
    await stream(pg, b.id, "zzzDEF12345");
    await moment(pg, b.id, { video: "zzzDEF12345" });
    expect(await latestEventId(db, String(a.id))).toBe(last);
    expect(await loadHelperEvents(db, String(a.id), last)).toEqual([]);
  });
});

test.describe("the pure parts", () => {
  test("parses `since` strictly", () => {
    expect(parseSince(null)).toBeNull();
    expect(parseSince("")).toBeNull();
    expect(parseSince("0")).toBe(0);
    expect(parseSince("123")).toBe(123);
    expect(parseSince("-1")).toBeNull();
    expect(parseSince("1.5")).toBeNull();
    expect(parseSince("1e3")).toBeNull();
    expect(parseSince("12 OR 1=1")).toBeNull();
    expect(parseSince("9".repeat(16))).toBeNull();
  });

  test("the replay buffer to ask for covers the delay, the wait, the lead-in and some spare", () => {
    expect(replayBufferNeeded(22)).toBe(22 + CLIP_AFTER_SECONDS + CLIP_BEFORE_SECONDS + 15);
    expect(replayBufferNeeded(58)).toBe(103);
    expect(replayBufferNeeded(-5)).toBe(45);
  });
});
