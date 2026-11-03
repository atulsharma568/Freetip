import { goalPercent, type GoalRepeat } from "../goal";
import type { GoalProgress } from "../goal-progress";
import { ladderLevel } from "./ladder";
import type { Block } from "./types";

// The pure half of the Pressure meter's reading: no database and no site imports, so the tip page
// and the owner's editor preview can use it in the browser. The numbers it is given come from
// `loadGoalProgress` (see pressure.ts), the goal engine behind the goal bar.

export type MeterSettings = Block<"pressureMeter">["settings"];

export interface MeterReading {
  title: string;
  repeat: GoalRepeat;
  // "today", "this week", "this month", or "" for a goal that never repeats.
  period: string;
  // Whole percent, 0 to 100.
  percent: number;
  // The rank word for that percent, from the meter's own words.
  word: string;
  reached: boolean;
  // Present only when the owner shows rupees. With "percent only" these keys are not in the
  // reading at all, so they cannot reach a fan or the network.
  raisedPaise?: number;
  targetPaise?: number;
  carryPaise?: number;
}

const PERIOD_WORD: Record<GoalRepeat, string> = { never: "", daily: "today", weekly: "this week", monthly: "this month" };

export function periodWord(repeat: GoalRepeat): string {
  return PERIOD_WORD[repeat] ?? "";
}

// The goal the meter follows: the one with the stored id if it is among the creator's own goals,
// otherwise the creator's first goal, otherwise none. An id that is not theirs never matches,
// because only their goals are in the list.
export function pickGoal(goals: readonly GoalProgress[], id: number | null): GoalProgress | null {
  return (id !== null ? goals.find((g) => g.id === id) : undefined) ?? goals[0] ?? null;
}

export function meterReading(goal: GoalProgress, settings: Pick<MeterSettings, "levels" | "show">): MeterReading {
  const percent = goalPercent(goal.raisedPaise, goal.effectiveTargetPaise);
  const reading: MeterReading = {
    title: goal.title,
    repeat: goal.repeat,
    period: periodWord(goal.repeat),
    percent,
    word: ladderLevel(percent / 100, settings.levels),
    reached: percent >= 100,
  };
  if (settings.show === "rupees") {
    reading.raisedPaise = goal.raisedPaise;
    reading.targetPaise = goal.effectiveTargetPaise;
    if (goal.carryPaise > 0) reading.carryPaise = goal.carryPaise;
  }
  return reading;
}
