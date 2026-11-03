import { PROCESSING_BPS, STANDARD_RATES, splitTip, type FeeRates } from "./money";

export { PLATFORM_BPS } from "./money";

// What a creator would keep from a captured tip, as an estimate: our platform fee and
// the processing charge, each rounded half up to the paise by `splitTip` (money.ts),
// the same rule the pricing page's worked example uses. `rates` is the pair the tip
// was charged at (saved on the order); without it the standard pair is used. The
// dashboard's SQL reads the same saved pair and does the same half-up integer maths,
// so the database and the browser agree. It is only ever shown as an estimate; real
// figures come from the books.
export const GATEWAY_BPS = PROCESSING_BPS;

export function estimateShare(grossPaise: number, rates: FeeRates = STANDARD_RATES): number {
  return splitTip(grossPaise, rates).creatorSharePaise;
}

export function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// How the tips page reads its address (`?range=7d&msg=1&page=2`). Anything
// unexpected falls back to the default rather than erroring.
export const TIP_RANGES = ["7d", "30d", "all"] as const;
export type TipRange = (typeof TIP_RANGES)[number];

export const TIPS_PAGE_SIZE = 20;
const MAX_PAGE = 1000;

export interface TipsQuery {
  range: TipRange;
  messageOnly: boolean;
  page: number;
}

type Param = string | string[] | undefined;

const first = (v: Param) => (Array.isArray(v) ? v[0] : v);

export function parseTipsQuery(params: Record<string, Param>): TipsQuery {
  const range = TIP_RANGES.find((r) => r === first(params.range)) ?? "all";
  const messageOnly = first(params.msg) === "1";
  const raw = first(params.page);
  const page = raw && /^\d{1,4}$/.test(raw) ? Number(raw) : 1;
  return { range, messageOnly, page: Math.min(Math.max(page, 1), MAX_PAGE) };
}

export function tipsHref({ range, messageOnly, page }: TipsQuery): string {
  const qs = new URLSearchParams();
  if (range !== "all") qs.set("range", range);
  if (messageOnly) qs.set("msg", "1");
  if (page > 1) qs.set("page", String(page));
  const s = qs.toString();
  return s ? `/dashboard/tips?${s}` : "/dashboard/tips";
}

// CSV export of the tips list.
export const EXPORT_MAX_ROWS = 10000;

// A cell a spreadsheet would run as a formula (=, +, -, @, tab, CR first) is
// prefixed with an apostrophe so fan-typed text stays text. Cells with commas,
// quotes or line breaks are quoted.
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const istParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatIst(d: Date): string {
  const p = Object.fromEntries(istParts.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

const plainRupees = (paise: number) => (paise / 100).toFixed(2);

export interface CsvTip {
  capturedAt: Date;
  name: string;
  amountPaise: number;
  sharePaise: number;
  message: string | null;
  messageStatus: "pending" | "approved" | "rejected";
}

// Amounts are plain numbers so a spreadsheet can sum them. A rejected message's
// text is already null, as on the tips page.
export function tipsCsv(tips: CsvTip[]): string {
  const header = [
    "Date (IST)",
    "Fan",
    "Amount (INR)",
    "Estimated share (INR)",
    "Message",
    "Message status",
  ];
  const lines = tips.map((t) =>
    [
      formatIst(t.capturedAt),
      t.name,
      plainRupees(t.amountPaise),
      plainRupees(t.sharePaise),
      t.message ?? "",
      t.messageStatus,
    ]
      .map(csvCell)
      .join(","),
  );
  return "\uFEFF" + [header.join(","), ...lines].join("\r\n") + "\r\n";
}

// Daily bar chart geometry. Bars are scaled to the busiest day; a day with any
// tips gets at least `minBar` so a small tip is still visible, a zero day gets
// none.
export interface DayBar {
  day: string;
  x: number;
  y: number;
  width: number;
  height: number;
  slotX: number;
  slotWidth: number;
}

export function dailyBars(
  days: { day: string; grossPaise: number }[],
  width: number,
  height: number,
  minBar = 3,
): DayBar[] {
  const slot = width / Math.max(days.length, 1);
  const barWidth = Math.max(slot - 4, 2);
  const max = Math.max(...days.map((d) => d.grossPaise), 0);
  return days.map((d, i) => {
    const h =
      d.grossPaise <= 0 || max <= 0
        ? 0
        : Math.max(minBar, Math.round((d.grossPaise / max) * height));
    return {
      day: d.day,
      x: i * slot + (slot - barWidth) / 2,
      y: height - h,
      width: barWidth,
      height: h,
      slotX: i * slot,
      slotWidth: slot,
    };
  });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-10-25" -> "25 Oct", without going through a Date and its time zone.
export function shortDay(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}
