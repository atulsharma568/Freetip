import type { Query } from "../accrual";
import { goalPercent } from "../goal";
import { loadGoalProgress } from "../goal-progress";
import { hasFeature } from "../plans";
import { resolveGoalBarStyle, type GoalBarStyle } from "./goal-bar-style";

// What the goal bar browser source is told (GET /api/overlay/<token>/goal), apart from the route so
// the tests can run it against an in-memory Postgres. Every goal bar of the creator (up to three),
// each with its title, the target it is measured against (the set target plus any shortfall carried
// over) and what has been raised since the goal was started or, for a daily, weekly or monthly goal,
// since its period began in the goal's own timezone.
//
// While the creator's "Custom tip page" switch is on, the owner may also have set the bar's look
// (colour, percent only, no goal-reached moment; migration 0053). It rides along as `style`. With
// "percent only" no rupee figure leaves the server: each goal carries its percent and nothing else
// about money. Anything unreadable, or a column that is not there yet, is today's bar.

export type GoalBarBody = {
  goals: Record<string, unknown>[];
  // The first bar, for a browser source still running the older page; left out with percent only,
  // so an old page shows nothing rather than a wrong bar.
  goal: Record<string, unknown> | null;
  style?: GoalBarStyle;
};

export async function goalBarBody(db: Query, creatorId: number, now = new Date()): Promise<GoalBarBody> {
  const progress = await loadGoalProgress(db, creatorId, now);

  let style: GoalBarStyle | null = null;
  try {
    const [row] = await db<{ paid_features: string[] | null; goal_bar_style: unknown }[]>`
      select paid_features, goal_bar_style from users where id = ${creatorId}
    `;
    if (row && hasFeature(row, "pageBuilder")) style = resolveGoalBarStyle(row.goal_bar_style);
  } catch (err) {
    console.error("Goal overlay: could not read the goal bar style (migration 0053 run?).", err);
  }

  const percentOnly = style?.show === "percent";
  const goals = progress.map((g): Record<string, unknown> =>
    percentOnly
      ? { title: g.title, repeat: g.repeat, percent: goalPercent(g.raisedPaise, g.effectiveTargetPaise) }
      : {
          title: g.title,
          targetPaise: g.effectiveTargetPaise,
          carryPaise: g.carryPaise,
          raisedPaise: g.raisedPaise,
          repeat: g.repeat,
        },
  );
  return { goals, goal: percentOnly ? null : (goals[0] ?? null), ...(style ? { style } : {}) };
}
