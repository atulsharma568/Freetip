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

// Repeating goals. Periods follow the clock of the goal's timezone (default India,
// UTC+5:30, no daylight saving); weeks start on Monday.
export const GOAL_REPEATS = ["never", "daily", "weekly", "monthly"] as const;
export type GoalRepeat = (typeof GOAL_REPEATS)[number];

export function parseRepeat(value: unknown): GoalRepeat {
  return GOAL_REPEATS.find((r) => r === value) ?? "never";
}

// How many goal bars a creator can have at once (they stack on the overlay).
export const MAX_GOALS = 3;

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

// A short list rather than every zone: the ones Indian creators and their fans are
// most likely to live in. Only these are accepted, so a stored name is always one
// the runtime knows.
export const GOAL_TIMEZONES: readonly { id: string; label: string }[] = [
  { id: "Asia/Kolkata", label: "India (IST)" },
  { id: "Asia/Kathmandu", label: "Nepal" },
  { id: "Asia/Colombo", label: "Sri Lanka" },
  { id: "Asia/Dhaka", label: "Bangladesh" },
  { id: "Asia/Karachi", label: "Pakistan" },
  { id: "Asia/Dubai", label: "UAE / Gulf" },
  { id: "Asia/Riyadh", label: "Saudi Arabia" },
  { id: "Asia/Bangkok", label: "Thailand / Vietnam" },
  { id: "Asia/Jakarta", label: "Indonesia (Jakarta)" },
  { id: "Asia/Singapore", label: "Singapore / Malaysia" },
  { id: "Asia/Manila", label: "Philippines" },
  { id: "Asia/Hong_Kong", label: "Hong Kong" },
  { id: "Asia/Tokyo", label: "Japan" },
  { id: "Australia/Sydney", label: "Sydney" },
  { id: "Pacific/Auckland", label: "New Zealand" },
  { id: "Africa/Johannesburg", label: "South Africa" },
  { id: "Africa/Lagos", label: "Nigeria" },
  { id: "Africa/Cairo", label: "Egypt" },
  { id: "Europe/London", label: "UK" },
  { id: "Europe/Berlin", label: "Central Europe" },
  { id: "Europe/Moscow", label: "Moscow" },
  { id: "America/Sao_Paulo", label: "Brazil (São Paulo)" },
  { id: "America/New_York", label: "US Eastern" },
  { id: "America/Chicago", label: "US Central" },
  { id: "America/Denver", label: "US Mountain" },
  { id: "America/Los_Angeles", label: "US Pacific" },
  { id: "America/Toronto", label: "Canada Eastern" },
  { id: "Pacific/Honolulu", label: "Hawaii" },
  { id: "UTC", label: "UTC" },
];

export function parseTimezone(value: unknown): string {
  return GOAL_TIMEZONES.find((z) => z.id === value)?.id ?? DEFAULT_TIMEZONE;
}

// Milliseconds the zone is ahead of UTC at this instant (daylight saving included).
function zoneOffsetMs(timeZone: string, instant: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(instant));
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wallAsUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return wallAsUtc - Math.floor(instant / 1000) * 1000;
}

// The real instant at which the zone's clock reads 00:00 on this calendar day.
// Two passes settle it on either side of a daylight-saving change.
function localMidnight(timeZone: string, y: number, m: number, d: number): number {
  const wall = Date.UTC(y, m, d);
  const first = wall - zoneOffsetMs(timeZone, wall);
  return wall - zoneOffsetMs(timeZone, first);
}

// Start of the period that contains `now`, as a real instant. `back` steps that many
// whole periods earlier (1 = the period that just finished).
export function periodStart(
  repeat: Exclude<GoalRepeat, "never">,
  now: Date,
  back = 0,
  timeZone: string = DEFAULT_TIMEZONE,
): Date {
  const local = new Date(now.getTime() + zoneOffsetMs(timeZone, now.getTime()));
  const y = local.getUTCFullYear();
  let m = local.getUTCMonth();
  let d = local.getUTCDate();
  if (repeat === "monthly") {
    m -= back;
    d = 1;
  } else if (repeat === "weekly") {
    d -= ((local.getUTCDay() + 6) % 7) + 7 * back;
  } else {
    d -= back;
  }
  // Date.UTC carries a negative month or day into the right year and month.
  const normal = new Date(Date.UTC(y, m, d));
  return new Date(localMidnight(timeZone, normal.getUTCFullYear(), normal.getUTCMonth(), normal.getUTCDate()));
}

// The part of the last period's target that was not raised, added to this period's
// target when the goal carries over. Never more than one extra target, so a long
// quiet spell cannot make the goal impossible.
export function carryPaise(targetPaise: number, lastTargetPaise: number, lastRaisedPaise: number): number {
  return Math.min(targetPaise, Math.max(0, lastTargetPaise - lastRaisedPaise));
}

export const REPEAT_LABEL: Record<GoalRepeat, string> = {
  never: "",
  daily: "Today",
  weekly: "This week",
  monthly: "This month",
};
