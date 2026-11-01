import type { Query } from "./accrual";
import { carryPaise, parseRepeat, parseTimezone, periodStart, type GoalRepeat } from "./goal";
import { closeFinishedPeriods } from "./goal-history";

// What each of a creator's goal bars shows right now. Shared by the overlay and the
// dashboard. No site imports and no `server-only`, so the tests can run it against
// an in-memory Postgres.

export type GoalProgress = {
  id: number;
  title: string;
  repeat: GoalRepeat;
  timezone: string;
  carryOver: boolean;
  targetPaise: number; // what the creator set
  carryPaise: number; // the shortfall carried in from the last period (0 when none)
  effectiveTargetPaise: number; // targetPaise + carryPaise: what the bar is measured against
  raisedPaise: number;
  since: string; // ISO time the bar counts from
};

type GoalRow = {
  id: string;
  title: string;
  target_paise: string;
  repeat: string;
  timezone: string;
  carry_over: boolean;
  started_at: Date;
};

type HistRow = { goal_id: string; period_start: Date; target_paise: string; raised_paise: string };

const HISTORY_LOOKBACK_MS = 70 * 24 * 60 * 60 * 1000; // covers the last finished month

export async function loadGoalProgress(db: Query, creatorId: number, now = new Date()): Promise<GoalProgress[]> {
  const goals = await db<GoalRow[]>`
    select id, title, target_paise, repeat, timezone, carry_over, started_at
    from goals where creator_id = ${creatorId}::bigint order by id
  `;
  if (goals.length === 0) return [];

  const plan = goals.map((g) => {
    const repeat = parseRepeat(g.repeat);
    const timezone = parseTimezone(g.timezone);
    const startedAt = new Date(g.started_at);
    return {
      id: Number(g.id),
      title: g.title,
      repeat,
      timezone,
      carryOver: g.carry_over && repeat !== "never",
      target: Number(g.target_paise),
      startedAt,
      since: repeat === "never" ? startedAt : periodStart(repeat, now, 0, timezone),
      last: repeat === "never" ? null : periodStart(repeat, now, 1, timezone),
    };
  });

  // Carry: needs the row for the period that just finished. If the goal existed
  // then and the row is not written yet, write it now (the daily job normally has).
  const carrying = plan.filter((p) => p.carryOver && p.last);
  const carry = new Map<number, number>();
  if (carrying.length > 0) {
    const readHistory = () =>
      db<HistRow[]>`
        select goal_id, period_start, target_paise, raised_paise from goal_history
        where creator_id = ${creatorId}::bigint and goal_id is not null
          and period_start >= ${new Date(now.getTime() - HISTORY_LOOKBACK_MS).toISOString()}::timestamptz
      `;
    const find = (rows: HistRow[], id: number, at: Date) =>
      rows.find((r) => Number(r.goal_id) === id && new Date(r.period_start).getTime() === at.getTime());
    let rows = await readHistory();
    if (carrying.some((p) => p.startedAt < p.since && !find(rows, p.id, p.last!))) {
      await closeFinishedPeriods(db, creatorId, now);
      rows = await readHistory();
    }
    for (const p of carrying) {
      const row = find(rows, p.id, p.last!);
      if (row) carry.set(p.id, carryPaise(p.target, Number(row.target_paise), Number(row.raised_paise)));
    }
  }

  const raised = await Promise.all(
    plan.map((p) =>
      db<{ raised: string }[]>`
        select coalesce(sum(gross_amount_minor), 0)::bigint as raised from tip_orders
        where creator_id = ${creatorId}::bigint and status = 'captured'
          and captured_at >= ${p.since.toISOString()}::timestamptz
      `,
    ),
  );

  return plan.map((p, i) => {
    const c = carry.get(p.id) ?? 0;
    return {
      id: p.id,
      title: p.title,
      repeat: p.repeat,
      timezone: p.timezone,
      carryOver: p.carryOver,
      targetPaise: p.target,
      carryPaise: c,
      effectiveTargetPaise: p.target + c,
      raisedPaise: Number(raised[i][0]?.raised ?? 0),
      since: p.since.toISOString(),
    };
  });
}
