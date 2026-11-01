// The one date formatter for the owner's pages. Everything is shown in IST
// (Asia/Kolkata); a missing or invalid date is a dash, never "Invalid Date".

export type FmtStyle = "datetime" | "date" | "short";

const OPTIONS: Record<FmtStyle, Intl.DateTimeFormatOptions> = {
  // 1 Nov 2026, 3:04 pm
  datetime: { dateStyle: "medium", timeStyle: "short" },
  // 1 Nov 2026
  date: { dateStyle: "medium" },
  // 1 Nov, 03:04 pm (a row in a long list)
  short: { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
};

const formatters = new Map<FmtStyle, Intl.DateTimeFormat>();

export function fmtIST(value: Date | string | null | undefined, style: FmtStyle = "datetime"): string {
  if (value === null || value === undefined || value === "") return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  let f = formatters.get(style);
  if (!f) {
    f = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", ...OPTIONS[style] });
    formatters.set(style, f);
  }
  return f.format(date);
}
