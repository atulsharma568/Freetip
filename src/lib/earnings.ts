import { FEES } from "./legal";

// What a creator would keep from a captured tip, as an estimate: our 5% and the
// payment processing charge (Razorpay's standard 2% + 18% GST), each rounded to
// the paise like `feeBreakdown` on the pricing page. Worked in whole basis
// points so the browser and the database round the same way. It leaves out the
// extra 0.4% UPI charge on tips above ₹2,000, so it is only ever shown as an
// estimate; real figures come from the payout engine once it exists.
export const PLATFORM_BPS = Math.round(FEES.platformPercent * 100);
export const GATEWAY_BPS = Math.round(FEES.gatewayPercent * 100);

const cut = (grossPaise: number, bps: number) =>
  Math.floor((grossPaise * bps + 5000) / 10000);

export function estimateShare(grossPaise: number): number {
  return grossPaise - cut(grossPaise, PLATFORM_BPS) - cut(grossPaise, GATEWAY_BPS);
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
