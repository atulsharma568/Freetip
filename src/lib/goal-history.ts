import type { Query } from "./accrual";
import { carryPaise, parseRepeat, parseTimezone, periodStart } from "./goal";

// No site imports and no `server-only`, so the tests can run it against an
// in-memory Postgres (callers pass the postgres.js client, cast to Query).

type GoalRow = {
  id: string;
  creator_id: string;
  title: string;
  target_paise: string;
  repeat: string;
  timezone: string;
  carry_over: boolean;
  started_at: Date;
};

// Writes the period that just finished for every repeating goal (all creators, or
// one). Safe to call any number of times: a period is written once per goal. The
// title and target are the ones set now. A goal created after the period began is
// not recorded for it. A goal that carries over has last period's shortfall added to
// the target, read from the period before (nothing is carried across a gap).
export async function closeFinishedPeriods(db: Query, creatorId?: number, now = new Date()): Promise<number> {
  const only = creatorId ?? null;
  const goals = await db<GoalRow[]>`
    select id, creator_id, title, target_paise, repeat, timezone, carry_over, started_at
    from goals
    where repeat <> 'never'
      and (${only}::bigint is null or creator_id = ${only}::bigint)
  `;
  let written = 0;
  for (const g of goals) {
    const repeat = parseRepeat(g.repeat);
    if (repeat === "never") continue;
    const zone = parseTimezone(g.timezone);
    const start = periodStart(repeat, now, 1, zone);
    const end = periodStart(repeat, now, 0, zone);
    if (new Date(g.started_at) >= end) continue;

    const target = Number(g.target_paise);
    let carry = 0;
    if (g.carry_over) {
      const before = periodStart(repeat, now, 2, zone);
      const [prev] = await db<{ target_paise: string; raised_paise: string }[]>`
        select target_paise, raised_paise from goal_history
        where goal_id = ${g.id}::bigint and period_start = ${before.toISOString()}::timestamptz
      `;
      if (prev) carry = carryPaise(target, Number(prev.target_paise), Number(prev.raised_paise));
    }
    const effective = target + carry;

    const rows = await db<{ goal_id: string }[]>`
      insert into goal_history
        (creator_id, goal_id, repeat, period_start, title, target_paise, carry_paise, raised_paise, hit, timezone)
      select ${g.creator_id}::bigint, ${g.id}::bigint, ${repeat}::text, ${start.toISOString()}::timestamptz,
             ${g.title}::text, ${effective}::bigint, ${carry}::bigint, r.raised, r.raised >= ${effective}::bigint,
             ${zone}::text
      from (
        select coalesce(sum(t.gross_amount_minor), 0)::bigint as raised from tip_orders t
        where t.creator_id = ${g.creator_id}::bigint and t.status = 'captured'
          and t.captured_at >= ${start.toISOString()}::timestamptz
          and t.captured_at < ${end.toISOString()}::timestamptz
      ) r
      on conflict (goal_id, period_start) where goal_id is not null do nothing
      returning goal_id
    `;
    written += rows.length;
  }
  return written;
}
