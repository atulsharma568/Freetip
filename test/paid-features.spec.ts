import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import { FEATURES, builtFeatureKeys, planFeatures, sanitizeFeatureKeys } from "../src/lib/plans";
import { loadSupporters, streakFrom, STREAK_WINDOW_SECONDS } from "../src/lib/supporters";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// The per-creator paid switches (migration 0035, src/lib/plans.ts) and the three
// supporter overlays that are gated by them.

let seq = 0;

async function creator(pg: PGlite, bannedWords = ""): Promise<number> {
  seq += 1;
  const r = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, creator_status, banned_words) values ($1, $2, $3, 'active', $4) returning id::text`,
    [`g${seq}`, `c${seq}@example.com`, `handle${seq}`, bannedWords],
  );
  return Number(r.rows[0].id);
}

async function tip(pg: PGlite, creatorId: number, o: { name?: string | null; anonymous?: boolean; rupees: number; at: string; status?: string }) {
  seq += 1;
  await pg.query(
    `insert into tip_orders (creator_id, public_reference, gross_amount_minor, fan_name, anonymous, status, captured_at)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [creatorId, `tip_${seq}`, o.rupees * 100, o.name ?? null, o.anonymous ?? false, o.status ?? "captured", o.at],
  );
}

const NOW = new Date("2026-11-10T12:00:00Z");
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();
const ALL = { streak: true, top: true, recent: true };

test.describe("which features a creator has", () => {
  test("a new creator has nothing switched on", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    const r = await pg.query<{ paid_features: string[] }>(`select paid_features from users where id = $1`, [id]);
    expect(r.rows[0].paid_features).toEqual([]);
    const f = planFeatures(r.rows[0]);
    expect(Object.values(f).some(Boolean)).toBe(false);
    expect(planFeatures(null).timestamps).toBe(false);
  });

  test("a feature is on only when it is ticked", () => {
    const f = planFeatures({ paid_features: ["timestamps", "supportStreak"] });
    expect(f.timestamps).toBe(true);
    expect(f.supportStreak).toBe(true);
    expect(f.topSupporter).toBe(false);
    expect(f.clipHelper).toBe(false);
  });

  test("the timestamp extras are off without the base switch", () => {
    const f = planFeatures({ paid_features: ["clipHelper", "highlightsPage", "editorLink", "tipMarks"] });
    expect(f.clipHelper || f.highlightsPage || f.editorLink || f.tipMarks).toBe(false);
    expect(planFeatures({ paid_features: ["timestamps", "clipHelper"] }).clipHelper).toBe(true);
  });

  test("a planned feature that is not built cannot be switched on", () => {
    expect(sanitizeFeatureKeys(["voiceNotes", "timestamps", "nonsense"])).toEqual(["timestamps"]);
    expect(planFeatures({ paid_features: ["voiceNotes"] }).voiceNotes).toBe(false);
    expect(builtFeatureKeys().every((k) => FEATURES.find((f) => f.key === k)?.built)).toBe(true);
  });
});

test.describe("support streak", () => {
  test("tips close together make a streak that counts down", () => {
    const times = [ago(1), ago(4), ago(9)].map((t) => new Date(t));
    const s = streakFrom(times, NOW);
    expect(s.count).toBe(3);
    expect(s.remainingSeconds).toBe(STREAK_WINDOW_SECONDS - 60);
  });

  test("a gap longer than the window ends the chain there", () => {
    const times = [ago(1), ago(5), ago(40)].map((t) => new Date(t));
    expect(streakFrom(times, NOW).count).toBe(2);
  });

  test("the streak is gone once the countdown has run out", () => {
    expect(streakFrom([new Date(ago(11))], NOW).count).toBe(0);
    expect(streakFrom([], NOW).count).toBe(0);
  });
});

test.describe("supporter overlays", () => {
  test("recent supporters: one line per name, anonymous and banned names hidden, newest first", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg, "badword");
    await tip(pg, c, { name: "Asha", rupees: 50, at: ago(30) });
    await tip(pg, c, { name: "Ravi", rupees: 100, at: ago(20) });
    await tip(pg, c, { name: "asha", rupees: 200, at: ago(10) });
    await tip(pg, c, { name: "Secret", anonymous: true, rupees: 70, at: ago(8) });
    await tip(pg, c, { name: "you badword", rupees: 30, at: ago(6) });
    await tip(pg, c, { name: "Ghost", rupees: 999, at: ago(2), status: "failed" });

    const out = await loadSupporters(db, c, "badword", { streak: false, top: false, recent: true }, NOW);
    expect(out.recent).toEqual([
      { name: "Anonymous", amountPaise: 3000 },
      { name: "Anonymous", amountPaise: 7000 },
      { name: "asha", amountPaise: 20000 },
      { name: "Ravi", amountPaise: 10000 },
    ]);
    expect(out.streak).toBeUndefined();
    expect(out.top).toBeUndefined();
  });

  test("top supporter: biggest named total in 30 days; anonymous, banned and old tips do not count", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg, "badword");
    await tip(pg, c, { name: "Asha", rupees: 60, at: ago(60) });
    await tip(pg, c, { name: "ASHA ", rupees: 70, at: ago(50) });
    await tip(pg, c, { name: "Ravi", rupees: 100, at: ago(40) });
    await tip(pg, c, { name: "Big Anon", anonymous: true, rupees: 5000, at: ago(30) });
    await tip(pg, c, { name: "bad badword", rupees: 4000, at: ago(20) });
    await tip(pg, c, { name: "Old Timer", rupees: 9000, at: new Date(NOW.getTime() - 31 * 86_400_000).toISOString() });

    const out = await loadSupporters(db, c, "badword", { streak: false, top: true, recent: false }, NOW);
    expect(out.top?.totalPaise).toBe(13000);
    expect(out.top?.name.toLowerCase().trim()).toBe("asha");
  });

  test("top supporter is empty when nobody named has tipped", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    await tip(pg, c, { anonymous: true, rupees: 100, at: ago(5) });
    const out = await loadSupporters(asLedgerDb(pg), c, "", ALL, NOW);
    expect(out.top).toBeNull();
    expect(out.streak?.count).toBe(1);
  });

  test("another creator's tips never show up", async () => {
    const pg = await freshDatabase();
    const a = await creator(pg);
    const b = await creator(pg);
    await tip(pg, b, { name: "Other", rupees: 500, at: ago(1) });
    const out = await loadSupporters(asLedgerDb(pg), a, "", ALL, NOW);
    expect(out.recent).toEqual([]);
    expect(out.top).toBeNull();
    expect(out.streak?.count).toBe(0);
  });
});
