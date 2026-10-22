// Date range helpers in IST (Asia/Kolkata, UTC+5:30).
// All returned values are UTC Date objects suitable for DB queries.

export type RangePreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month";

export type DateRange = { from: Date; to: Date; label: string };

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function nowIST(): Date {
  return new Date(Date.now() + IST_OFFSET_MS);
}

// Returns start of given UTC-shifted IST date at midnight UTC.
function startOfDayIST(ist: Date): Date {
  const midnight = new Date(
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()),
  );
  return new Date(midnight.getTime() - IST_OFFSET_MS);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function rangeFromPreset(preset: RangePreset): DateRange {
  const now = new Date();
  const ist = nowIST();

  const todayStart = startOfDayIST(ist);
  const tomorrowStart = addDays(todayStart, 1);
  const yesterdayStart = addDays(todayStart, -1);

  // ISO week: Monday = day 1. getUTCDay() returns 0 (Sun)..6 (Sat).
  const dayOfWeek = ist.getUTCDay() === 0 ? 6 : ist.getUTCDay() - 1;
  const thisWeekStart = addDays(todayStart, -dayOfWeek);
  const lastWeekStart = addDays(thisWeekStart, -7);
  const lastWeekEnd = thisWeekStart;

  const thisMonthStart = new Date(
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - IST_OFFSET_MS,
  );
  const lastMonthStart = new Date(
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() - 1, 1) - IST_OFFSET_MS,
  );
  const lastMonthEnd = thisMonthStart;

  switch (preset) {
    case "today":
      return { from: todayStart, to: now, label: "Today" };
    case "yesterday":
      return { from: yesterdayStart, to: todayStart, label: "Yesterday" };
    case "this_week":
      return { from: thisWeekStart, to: now, label: "This week" };
    case "last_week":
      return { from: lastWeekStart, to: lastWeekEnd, label: "Last week" };
    case "this_month":
      return { from: thisMonthStart, to: now, label: "This month" };
    case "last_month":
      return { from: lastMonthStart, to: lastMonthEnd, label: "Last month" };
  }
}

export function parsePreset(value: string | undefined): RangePreset {
  const valid: RangePreset[] = [
    "today",
    "yesterday",
    "this_week",
    "last_week",
    "this_month",
    "last_month",
  ];
  return valid.includes(value as RangePreset)
    ? (value as RangePreset)
    : "this_month";
}
