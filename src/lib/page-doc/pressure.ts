import type { Query } from "../accrual";
import { loadGoalProgress } from "../goal-progress";
import { hasFeature } from "../plans";
import { meterReading, pickGoal, type MeterReading, type MeterSettings } from "./meter-reading";
import { parsePageDoc } from "./parse";
import type { Block } from "./types";

export { meterReading, periodWord, pickGoal, type MeterReading, type MeterSettings } from "./meter-reading";

// The Pressure meter's reading (page builder phase 4): one of a creator's goals as a percent, a
// rank word and, if the owner allows it, rupee figures (see meter-reading.ts). The meter has no
// period or money logic of its own: every number comes from `loadGoalProgress`, the engine behind
// the goal bar, so the two always agree. No site imports, so the tests run it against an
// in-memory Postgres.

// The creator's reading for a meter's settings, or null when they have no goal.
export async function loadMeterReading(db: Query, creatorId: number, settings: MeterSettings, now = new Date()): Promise<MeterReading | null> {
  const goal = pickGoal(await loadGoalProgress(db, creatorId, now), settings.goal);
  return goal ? meterReading(goal, settings) : null;
}

export type MeterPlace = "page" | "obs";

// What decides whether a creator's meter is shown: both switches on, and a visible meter block in
// the published page that is set to show in this place. Anything else is null (no meter), so a
// switch turned off, a hidden block or the other place all give the same empty answer.
export function publishedMeter(
  row: { paid_features: string[] | null; page_published: unknown } | null | undefined,
  place: MeterPlace,
): MeterSettings | null {
  if (!row || !hasFeature(row, "pressureMeter")) return null;
  const parsed = parsePageDoc(row.page_published);
  const block = parsed?.doc.blocks.find((b): b is Block<"pressureMeter"> => b.type === "pressureMeter");
  if (!block || !block.visible) return null;
  return block.settings.where === "both" || block.settings.where === place ? block.settings : null;
}
