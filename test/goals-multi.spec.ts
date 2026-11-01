import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import { closeCreatorAccount } from "../src/lib/account-close";
import { closeFinishedPeriods } from "../src/lib/goal-history";
import { loadGoalProgress } from "../src/lib/goal-progress";
import { asLedgerDb, freshDatabase, readMigration } from "./helpers/pg";

// Several goals, other timezones and carry-over against the real schema (in-memory
// Postgres). The clock is passed in, so the dates below are fixed.

let seq = 0;

async function creator(pg: PGlite): Promise<number> {
  seq += 1;
  const r = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, creator_status) values ($1, $2, $3, 'active') returning id::text`,
    [`g${seq}`, `c${seq}@example.com`, `handle${seq}`],
  );
  return Number(r.rows[0].id);
}

async function goal(
  pg: PGlite,
  creatorId: number,
  o: { title?: string; rupees: number; repeat?: string; tz?: string; carry?: boolean },
): Promise<number> {
  const r = await pg.query<{ id: string }>(
    `insert into goals (creator_id, title, target_paise, repeat, timezone, carry_over, started_at)
     values ($1, $2, $3, $4, $5, $6, '2026-01-01T00:00:00Z') returning id::text`,
    [creatorId, o.title ?? "Mic", o.rupees * 100, o.repeat ?? "daily", o.tz ?? "Asia/Kolkata", o.carry ?? false],
  );
  return Number(r.rows[0].id);
}

async function tip(pg: PGlite, creatorId: number, rupees: number, at: string) {
  seq += 1;
  await pg.query(
    `insert into tip_orders (creator_id, public_reference, gross_amount_minor, status, captured_at)
     values ($1, $2, $3, 'captured', $4)`,
    [creatorId, `tip_${seq}`, rupees * 100, at],
  );
}

test("each goal counts from the start of its own day: India and New York differ", async () => {
  const pg = await freshDatabase();
  const db = asLedgerDb(pg);
  const c = await creator(pg);
  await goal(pg, c, { title: "India", rupees: 1000, tz: "Asia/Kolkata" });
  await goal(pg, c, { title: "New York", rupees: 1000, tz: "America/New_York" });
  await goal(pg, c, { title: "Forever", rupees: 5000, repeat: "never" });
  // 2026-11-05T12:00Z is 17:30 in India and 07:00 in New York (EST).
  // A tip at 03:00Z is 08:30 on 5 Nov in India but 22:00 on 4 Nov in New York.
  await tip(pg, c, 200, "2026-11-05T03:00:00Z");
  await tip(pg, c, 50, "2026-11-05T10:00:00Z");

  const goals = await loadGoalProgress(db, c, new Date("2026-11-05T12:00:00Z"));
  const by = Object.fromEntries(goals.map((g) => [g.title, g.raisedPaise / 100]));
  expect(by).toEqual({ India: 250, "New York": 50, Forever: 250 });
});

test("a goal that carries over adds the shortfall to the next period, up to one extra target", async () => {
  const pg = await freshDatabase();
  const db = asLedgerDb(pg);
  const c = await creator(pg);
  const g = await goal(pg, c, { rupees: 1000, carry: true });
  await tip(pg, c, 600, "2026-11-03T10:00:00Z"); // India Tue 3 Nov
  await tip(pg, c, 300, "2026-11-04T10:00:00Z"); // India Wed 4 Nov
  await tip(pg, c, 100, "2026-11-05T02:00:00Z"); // India Thu 5 Nov, 07:30

  expect(await closeFinishedPeriods(db, c, new Date("2026-11-04T04:30:00Z"))).toBe(1); // 3 Nov
  expect(await closeFinishedPeriods(db, c, new Date("2026-11-05T04:30:00Z"))).toBe(1); // 4 Nov
  expect(await closeFinishedPeriods(db, c, new Date("2026-11-05T04:30:00Z"))).toBe(0); // once only

  const hist = await pg.query<{ target_paise: string; carry_paise: string; raised_paise: string; hit: boolean }>(
    `select target_paise, carry_paise, raised_paise, hit from goal_history where goal_id = $1 order by period_start`,
    [g],
  );
  expect(hist.rows.map((r) => [Number(r.target_paise), Number(r.carry_paise), Number(r.raised_paise), r.hit])).toEqual([
    [100000, 0, 60000, false],
    [140000, 40000, 30000, false], // 400 short on the 3rd, carried into the 4th
  ]);

  // Today: 4 Nov was 1100 short of 1400, but only one extra target (1000) is carried.
  const [today] = await loadGoalProgress(db, c, new Date("2026-11-05T04:30:00Z"));
  expect(today).toMatchObject({ carryPaise: 100000, effectiveTargetPaise: 200000, raisedPaise: 10000, carryOver: true });
});

test("the shortfall is written when the dashboard or overlay asks, if the daily job has not run", async () => {
  const pg = await freshDatabase();
  const db = asLedgerDb(pg);
  const c = await creator(pg);
  await goal(pg, c, { rupees: 1000, carry: true });
  await goal(pg, c, { title: "No carry", rupees: 1000, carry: false });
  await tip(pg, c, 700, "2026-11-04T10:00:00Z");
  const goals = await loadGoalProgress(db, c, new Date("2026-11-05T04:30:00Z"));
  expect(goals.map((g) => [g.title, g.carryPaise / 100])).toEqual([["Mic", 300], ["No carry", 0]]);
});

test("a goal made this period, or one that does not carry, gets no carry-over", async () => {
  const pg = await freshDatabase();
  const db = asLedgerDb(pg);
  const c = await creator(pg);
  const g = await goal(pg, c, { rupees: 1000, carry: true });
  await pg.query(`update goals set started_at = '2026-11-05T01:00:00Z' where id = $1`, [g]);
  const [p] = await loadGoalProgress(db, c, new Date("2026-11-05T04:30:00Z"));
  expect(p.carryPaise).toBe(0);
  expect(await closeFinishedPeriods(db, c, new Date("2026-11-05T04:30:00Z"))).toBe(0);
});

test("the old single goal is brought over once, and its history attached", async () => {
  const pg = await freshDatabase();
  const c = await creator(pg);
  await pg.query(
    `update users set goal_title = 'Old goal', goal_target_paise = 250000, goal_repeat = 'weekly',
                      goal_started_at = '2026-10-01T00:00:00Z', goals_migrated = false where id = $1`,
    [c],
  );
  await pg.query(
    `insert into goal_history (creator_id, repeat, period_start, title, target_paise, raised_paise, hit)
     values ($1, 'weekly', '2026-10-25T18:30:00Z', 'Old goal', 250000, 100000, false)`,
    [c],
  );
  await pg.exec(readMigration("0028_multi_goals.sql"));
  const goals = await pg.query<{ id: string; title: string; repeat: string; timezone: string }>(
    `select id::text, title, repeat, timezone from goals where creator_id = $1`,
    [c],
  );
  expect(goals.rows).toHaveLength(1);
  expect(goals.rows[0]).toMatchObject({ title: "Old goal", repeat: "weekly", timezone: "Asia/Kolkata" });
  const hist = await pg.query<{ goal_id: string }>(`select goal_id::text from goal_history where creator_id = $1`, [c]);
  expect(hist.rows[0].goal_id).toBe(goals.rows[0].id);

  // The creator removes it; running the migration again must not bring it back.
  await pg.query(`delete from goals where creator_id = $1`, [c]);
  await pg.exec(readMigration("0028_multi_goals.sql"));
  expect((await pg.query(`select 1 from goals where creator_id = $1`, [c])).rows).toHaveLength(0);
});

test("closing the account erases the goals and their history", async () => {
  const pg = await freshDatabase();
  const db = asLedgerDb(pg);
  const c = await creator(pg);
  await goal(pg, c, { rupees: 1000 });
  await tip(pg, c, 10, "2026-11-04T10:00:00Z");
  await closeFinishedPeriods(db, c, new Date("2026-11-05T04:30:00Z"));
  expect((await pg.query(`select 1 from goal_history where creator_id = $1`, [c])).rows).toHaveLength(1);

  const res = await closeCreatorAccount(db, c, { role: "creator", userId: c });
  expect(res.status).toBe("closed");
  expect((await pg.query(`select 1 from goals where creator_id = $1`, [c])).rows).toHaveLength(0);
  expect((await pg.query(`select 1 from goal_history where creator_id = $1`, [c])).rows).toHaveLength(0);
});
