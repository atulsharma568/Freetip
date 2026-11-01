// Goal bar rules, shared by the dashboard action and the overlay.

export const GOAL_TITLE_MAX = 60;
export const GOAL_MIN_RUPEES = 10;
export const GOAL_MAX_RUPEES = 10_000_000;

export type GoalCheck =
  | { ok: true; title: string; targetPaise: number }
  | { ok: false; message: string };

export function checkGoal(rawTitle: unknown, rawRupees: unknown): GoalCheck {
  const title = String(rawTitle ?? "").replace(/\s+/g, " ").trim().slice(0, GOAL_TITLE_MAX);
  if (!title) return { ok: false, message: "Give the goal a name." };
  const rupees = Number(String(rawRupees ?? "").replace(/,/g, "").trim());
  if (!Number.isInteger(rupees) || rupees < GOAL_MIN_RUPEES || rupees > GOAL_MAX_RUPEES) {
    return { ok: false, message: `Target must be a whole number from ₹${GOAL_MIN_RUPEES} to ₹${GOAL_MAX_RUPEES.toLocaleString("en-IN")}.` };
  }
  return { ok: true, title, targetPaise: rupees * 100 };
}

// 0 to 100, whole percent, never above 100.
export function goalPercent(raisedPaise: number, targetPaise: number): number {
  if (targetPaise <= 0) return 0;
  return Math.min(100, Math.max(0, Math.floor((raisedPaise / targetPaise) * 100)));
}

// Repeating goals. Periods follow the clock in India (UTC+5:30, no daylight saving),
// weeks start on Monday.
export const GOAL_REPEATS = ["never", "daily", "weekly", "monthly"] as const;
export type GoalRepeat = (typeof GOAL_REPEATS)[number];

export function parseRepeat(value: unknown): GoalRepeat {
  return GOAL_REPEATS.find((r) => r === value) ?? "never";
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Start of the period that contains `now`, as a real instant. `back` steps that many
// whole periods earlier (1 = the period that just finished).
export function periodStart(repeat: Exclude<GoalRepeat, "never">, now: Date, back = 0): Date {
  const local = new Date(now.getTime() + IST_OFFSET_MS);
  const y = local.getUTCFullYear();
  let m = local.getUTCMonth();
  let d = local.getUTCDate();
  if (repeat === "monthly") {
    m -= back;
    d = 1;
  } else if (repeat === "weekly") {
    d -= (local.getUTCDay() + 6) % 7 + 7 * back;
  } else {
    d -= back;
  }
  return new Date(Date.UTC(y, m, d) - IST_OFFSET_MS);
}

export const REPEAT_LABEL: Record<GoalRepeat, string> = {
  never: "",
  daily: "Today",
  weekly: "This week",
  monthly: "This month",
};
