import "server-only";
import { getDb } from "@/lib/db";
import { periodStart, type GoalRepeat } from "@/lib/goal";

type Db = NonNullable<ReturnType<typeof getDb>>;

// Writes the period that just finished for repeating goals (all creators, or one).
// Safe to call any number of times: a period is written once. The title and target
// are the ones set now. A goal created after the period began is not recorded for it.
export async function closeFinishedPeriods(db: Db, creatorId?: number): Promise<number> {
  const now = new Date();
  let written = 0;
  for (const repeat of ["daily", "weekly", "monthly"] as const satisfies readonly GoalRepeat[]) {
    const start = periodStart(repeat, now, 1);
    const end = periodStart(repeat, now, 0);
    const rows = await db`
      insert into goal_history (creator_id, repeat, period_start, title, target_paise, raised_paise, hit)
      select u.id, ${repeat}, ${start}, u.goal_title, u.goal_target_paise, r.raised, r.raised >= u.goal_target_paise
      from users u
      cross join lateral (
        select coalesce(sum(t.gross_amount_minor), 0)::bigint as raised from tip_orders t
        where t.creator_id = u.id and t.status = 'captured'
          and t.captured_at >= ${start} and t.captured_at < ${end}
      ) r
      where u.goal_repeat = ${repeat}
        and u.goal_title is not null and u.goal_target_paise is not null
        and coalesce(u.goal_started_at, u.created_at) < ${end}
        and (${creatorId ?? null}::bigint is null or u.id = ${creatorId ?? null}::bigint)
      on conflict do nothing
      returning creator_id
    `;
    written += rows.length;
  }
  return written;
}
