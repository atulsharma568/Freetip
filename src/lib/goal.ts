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
