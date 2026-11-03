import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import { loadGoalProgress, type GoalProgress } from "../src/lib/goal-progress";
import { defaultPageDoc } from "../src/lib/page-doc/defaults";
import { addBlock, setChoice } from "../src/lib/page-doc/edit";
import { ONE_PIECE_LADDER } from "../src/lib/page-doc/ladder";
import { loadMeterReading, meterReading, periodWord, pickGoal, publishedMeter, type MeterSettings } from "../src/lib/page-doc/pressure";
import type { PageDoc } from "../src/lib/page-doc/types";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// The Pressure meter's reading (page builder phase 4): the numbers are the goal engine's own.

const settings = (patch: Partial<MeterSettings> = {}): MeterSettings => ({
  goal: null,
  levels: ONE_PIECE_LADDER.levels,
  show: "rupees",
  where: "both",
  celebrate: true,
  fill: null,
  heading: "",
  ...patch,
});

const goalOf = (patch: Partial<GoalProgress> = {}): GoalProgress => ({
  id: 1,
  title: "New mic",
  repeat: "weekly",
  timezone: "Asia/Kolkata",
  carryOver: false,
  targetPaise: 100000,
  carryPaise: 0,
  effectiveTargetPaise: 100000,
  raisedPaise: 0,
  since: "2026-11-02T00:00:00.000Z",
  ...patch,
});

test.describe("the reading", () => {
  test("percent, rank word and period word follow the goal", () => {
    const at = (raised: number) => meterReading(goalOf({ raisedPaise: raised }), settings());
    expect(at(0)).toMatchObject({ percent: 0, word: "Rookie", reached: false, period: "this week" });
    expect(at(30000)).toMatchObject({ percent: 30, word: "Supernova" });
    expect(at(60000)).toMatchObject({ percent: 60, word: "Warlord" });
    expect(at(90000)).toMatchObject({ percent: 90, word: "Yonko" });
    expect(at(99000)).toMatchObject({ percent: 99, word: "Pirate King", reached: false });
    expect(at(100000)).toMatchObject({ percent: 100, word: "Pirate King", reached: true });
  });

  test("a raised amount over the target stays at 100", () => {
    expect(meterReading(goalOf({ raisedPaise: 350000 }), settings())).toMatchObject({ percent: 100, reached: true });
  });

  test("the period word comes from the goal's repeat", () => {
    expect([periodWord("daily"), periodWord("weekly"), periodWord("monthly"), periodWord("never")]).toEqual(["today", "this week", "this month", ""]);
  });

  test("the carried shortfall makes the target larger and is shown only with rupees", () => {
    const g = goalOf({ carryOver: true, carryPaise: 40000, effectiveTargetPaise: 140000, raisedPaise: 70000 });
    const r = meterReading(g, settings());
    expect(r).toMatchObject({ percent: 50, targetPaise: 140000, raisedPaise: 70000, carryPaise: 40000 });
    expect(meterReading(goalOf({ raisedPaise: 5 }), settings())).not.toHaveProperty("carryPaise");
  });

  test("percent only leaves every rupee figure out of the reading", () => {
    const g = goalOf({ carryOver: true, carryPaise: 40000, effectiveTargetPaise: 140000, raisedPaise: 70000 });
    const r = meterReading(g, settings({ show: "percent" }));
    expect(r.percent).toBe(50);
    expect(Object.keys(r).sort()).toEqual(["percent", "period", "reached", "repeat", "title", "word"]);
    expect(JSON.stringify(r)).not.toMatch(/70000|140000|40000|Paise/);
  });

  test("a target of zero never divides by zero", () => {
    expect(meterReading(goalOf({ effectiveTargetPaise: 0, raisedPaise: 100 }), settings()).percent).toBe(0);
  });
});

test.describe("choosing the goal", () => {
  const goals = [goalOf({ id: 5, title: "A" }), goalOf({ id: 9, title: "B" })];
  test("the stored id, else the first goal, else none", () => {
    expect(pickGoal(goals, 9)?.title).toBe("B");
    expect(pickGoal(goals, null)?.title).toBe("A");
    expect(pickGoal(goals, 77)?.title).toBe("A");
    expect(pickGoal([], 9)).toBeNull();
  });
});

test.describe("which meter a creator shows", () => {
  const withMeter = (patch: Record<string, unknown> = {}): PageDoc => {
    let doc = addBlock(defaultPageDoc(), "pressureMeter").doc;
    for (const [key, value] of Object.entries(patch)) doc = setChoice(doc, "pressureMeter", key, String(value)).doc;
    return doc;
  };
  const row = (doc: PageDoc | null, features = ["pageBuilder", "pressureMeter"]) => ({ paid_features: features, page_published: doc });

  test("both switches on and a visible meter shows it", () => {
    expect(publishedMeter(row(withMeter()), "page")).not.toBeNull();
    expect(publishedMeter(row(withMeter()), "obs")).not.toBeNull();
  });

  test("either switch off, nothing published, or no creator gives none", () => {
    expect(publishedMeter(row(withMeter(), ["pressureMeter"]), "page")).toBeNull();
    expect(publishedMeter(row(withMeter(), ["pageBuilder"]), "page")).toBeNull();
    expect(publishedMeter(row(null), "page")).toBeNull();
    expect(publishedMeter(row(defaultPageDoc()), "page")).toBeNull();
    expect(publishedMeter(null, "page")).toBeNull();
    expect(publishedMeter(row("not a page" as never), "page")).toBeNull();
  });

  test("a hidden meter gives none", () => {
    const doc = withMeter();
    doc.blocks.find((b) => b.type === "pressureMeter")!.visible = false;
    expect(publishedMeter(row(doc), "page")).toBeNull();
  });

  test("where decides the place", () => {
    expect(publishedMeter(row(withMeter({ where: "page" })), "page")).not.toBeNull();
    expect(publishedMeter(row(withMeter({ where: "page" })), "obs")).toBeNull();
    expect(publishedMeter(row(withMeter({ where: "obs" })), "page")).toBeNull();
    expect(publishedMeter(row(withMeter({ where: "obs" })), "obs")).not.toBeNull();
  });
});

let seq = 0;

async function creator(pg: PGlite): Promise<number> {
  seq += 1;
  const r = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, creator_status) values ($1, $2, $3, 'active') returning id::text`,
    [`pm${seq}`, `pm${seq}@example.com`, `pmhandle${seq}`],
  );
  return Number(r.rows[0].id);
}

async function goal(pg: PGlite, creatorId: number, o: { title?: string; rupees: number; repeat?: string; tz?: string; carry?: boolean }): Promise<number> {
  const r = await pg.query<{ id: string }>(
    `insert into goals (creator_id, title, target_paise, repeat, timezone, carry_over, started_at)
     values ($1, $2, $3, $4, $5, $6, '2026-01-01T00:00:00Z') returning id::text`,
    [creatorId, o.title ?? "Mic", o.rupees * 100, o.repeat ?? "weekly", o.tz ?? "Asia/Kolkata", o.carry ?? false],
  );
  return Number(r.rows[0].id);
}

async function tip(pg: PGlite, creatorId: number, rupees: number, at: string) {
  seq += 1;
  await pg.query(`insert into tip_orders (creator_id, public_reference, gross_amount_minor, status, captured_at) values ($1, $2, $3, 'captured', $4)`, [
    creatorId,
    `pmtip_${seq}`,
    rupees * 100,
    at,
  ]);
}

test.describe("against the database", () => {
  test("the meter agrees with the goal engine at the same moment, across a week's edge", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    await goal(pg, c, { rupees: 1000, repeat: "weekly" });
    // India Sunday 8 Nov 2026 late evening, then Monday 9 Nov early morning (a new week).
    const sunday = new Date("2026-11-08T17:00:00Z"); // Sun 22:30 IST
    const monday = new Date("2026-11-08T20:00:00Z"); // Mon 01:30 IST
    await tip(pg, c, 400, "2026-11-08T15:00:00Z"); // Sun 20:30 IST
    expect(await loadMeterReading(db, c, settings(), sunday)).toMatchObject({ percent: 40, raisedPaise: 40000 });
    await tip(pg, c, 100, "2026-11-08T19:00:00Z"); // Mon 00:30 IST, 9 Nov
    expect(await loadMeterReading(db, c, settings(), sunday)).toMatchObject({ percent: 50 });
    expect(await loadMeterReading(db, c, settings(), monday)).toMatchObject({ percent: 10, raisedPaise: 10000 });
    for (const now of [sunday, monday]) {
      const [g] = await loadGoalProgress(db, c, now);
      expect((await loadMeterReading(db, c, settings(), now))?.raisedPaise).toBe(g.raisedPaise);
    }
  });

  test("a daily goal turns over at its own midnight", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    await goal(pg, c, { rupees: 500, repeat: "daily" });
    await tip(pg, c, 500, "2026-11-05T17:00:00Z"); // 22:30 IST on the 5th
    expect(await loadMeterReading(db, c, settings(), new Date("2026-11-05T18:00:00Z"))).toMatchObject({ percent: 100, reached: true });
    expect(await loadMeterReading(db, c, settings(), new Date("2026-11-05T19:00:00Z"))).toMatchObject({ percent: 0, reached: false, word: "Rookie" }); // 00:30 IST on the 6th
  });

  test("another creator's goal id is ignored, and no goal gives null", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const mine = await creator(pg);
    const other = await creator(pg);
    const mineGoal = await goal(pg, mine, { title: "Mine", rupees: 1000 });
    const theirGoal = await goal(pg, other, { title: "Theirs", rupees: 1000 });
    await tip(pg, other, 900, "2026-11-04T10:00:00Z");
    const now = new Date("2026-11-05T10:00:00Z");
    const r = await loadMeterReading(db, mine, settings({ goal: theirGoal }), now);
    expect(r?.title).toBe("Mine");
    expect(r?.percent).toBe(0);
    expect((await loadMeterReading(db, mine, settings({ goal: mineGoal }), now))?.title).toBe("Mine");
    expect(await loadMeterReading(db, await creator(pg), settings(), now)).toBeNull();
  });

  test("a meter pointing at the second goal follows it, and a deleted goal falls back to the first", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    await goal(pg, c, { title: "First", rupees: 1000 });
    const second = await goal(pg, c, { title: "Second", rupees: 200 });
    await tip(pg, c, 100, "2026-11-04T10:00:00Z");
    const now = new Date("2026-11-05T10:00:00Z");
    expect(await loadMeterReading(db, c, settings({ goal: second }), now)).toMatchObject({ title: "Second", percent: 50 });
    await pg.query(`delete from goals where id = $1`, [second]);
    expect(await loadMeterReading(db, c, settings({ goal: second }), now)).toMatchObject({ title: "First", percent: 10 });
  });
});
