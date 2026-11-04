// The money rules, in one place: no database, no site imports, so the browser,
// the server and the tests all work out the same numbers. Amounts are whole
// paise (integers); anything a database hands back as a string goes through
// `toPaise` once, at the edge.
//
// A tip is split into our platform fee and a processing charge (owner's choice,
// 2026-10-30), each worked in basis points and rounded half up to the paise. The
// creator keeps what is left. The rates are the owner's to set (2026-11-03): a
// site-wide standard (5% and 3%, 8% in all, from 2026-11-04, until the owner changes it) and, per creator,
// an optional pair of their own. The pair a tip is charged at is saved on the
// order when it is created (`tip_orders.platform_bps`, `processing_bps`), so a
// later change of rate never rewrites an old tip. `RULE_VERSION` is saved with
// every fee line.
export const RULE_VERSION = "2026-11-03.1";
// The standard rates, used when nothing else is set (and the rate every tip made
// before the owner could change them was charged at).
export const PLATFORM_BPS = 500; // 5%
// The smallest tip, the same for every creator (owner, 2026-11-01).
export const MIN_TIP_PAISE = 2000;
export const PROCESSING_BPS = 300; // 3%, shown as Freetip's processing charge (2.75% until 2026-11-04)

// The highest the owner can set, so a slip of the finger (50 for 5) is refused. Together they
// can never take more than 40% of a tip, so the creator's share cannot go below nothing.
export const MAX_PLATFORM_BPS = 3000; // 30%
export const MAX_PROCESSING_BPS = 1000; // 10%

export interface FeeRates {
  platformBps: number;
  processingBps: number;
}

export const STANDARD_RATES: FeeRates = { platformBps: PLATFORM_BPS, processingBps: PROCESSING_BPS };

// The pair every tip made before 2026-11-04 was charged at. It is also what the database
// columns `tip_orders.platform_bps` and `processing_bps` default to (migration 0054), so an order
// saved without its own pair means this one. Never change it.
export const LEGACY_RATES: FeeRates = { platformBps: 500, processingBps: 275 };

export function checkRates(rates: FeeRates): FeeRates {
  const { platformBps, processingBps } = rates;
  if (!Number.isInteger(platformBps) || platformBps < 0 || platformBps > MAX_PLATFORM_BPS) {
    throw new RangeError(`The platform fee is outside 0 to ${MAX_PLATFORM_BPS / 100}%: ${platformBps} basis points`);
  }
  if (!Number.isInteger(processingBps) || processingBps < 0 || processingBps > MAX_PROCESSING_BPS) {
    throw new RangeError(`The processing charge is outside 0 to ${MAX_PROCESSING_BPS / 100}%: ${processingBps} basis points`);
  }
  return rates;
}

const cut = (paise: number, bps: number) => Math.floor((paise * bps + 5000) / 10000);

export function toPaise(value: string | number | bigint): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new RangeError(`Not a whole number of paise: ${String(value)}`);
  return n;
}

export interface TipSplit {
  grossPaise: number;
  platformFeePaise: number;
  processingPaise: number;
  creatorSharePaise: number;
}

export function splitTip(grossPaise: number, rates: FeeRates = STANDARD_RATES): TipSplit {
  if (!Number.isSafeInteger(grossPaise) || grossPaise <= 0) {
    throw new RangeError(`A tip must be a positive whole number of paise: ${grossPaise}`);
  }
  checkRates(rates);
  const platformFeePaise = cut(grossPaise, rates.platformBps);
  const processingPaise = cut(grossPaise, rates.processingBps);
  return {
    grossPaise,
    platformFeePaise,
    processingPaise,
    creatorSharePaise: grossPaise - platformFeePaise - processingPaise,
  };
}

export type LedgerAccountCode =
  | "processor_clearing"
  | "creator_payable"
  | "platform_fee_revenue"
  | "gateway_fee_expense";

export interface PostingLine {
  account: LedgerAccountCode;
  debitPaise: number;
  creditPaise: number;
}

// What a captured tip posts. Razorpay owes us the whole tip (debit
// processor_clearing); we owe the creator their share and book our fee. The
// processing charge is credited to gateway_fee_expense: it is what we recover
// from the creator, and Razorpay's real charge is debited there later, so what
// is left on that account is our gain or loss on processing. A zero amount is
// not a line (the ledger refuses lines of nothing).
export function capturePosting(split: TipSplit): PostingLine[] {
  const all: PostingLine[] = [
    { account: "processor_clearing", debitPaise: split.grossPaise, creditPaise: 0 },
    { account: "creator_payable", debitPaise: 0, creditPaise: split.creatorSharePaise },
    { account: "platform_fee_revenue", debitPaise: 0, creditPaise: split.platformFeePaise },
    { account: "gateway_fee_expense", debitPaise: 0, creditPaise: split.processingPaise },
  ];
  const lines = all.filter((l) => l.debitPaise > 0 || l.creditPaise > 0);
  const debit = lines.reduce((s, l) => s + l.debitPaise, 0);
  const credit = lines.reduce((s, l) => s + l.creditPaise, 0);
  if (debit !== credit) throw new Error(`Unbalanced posting: debit ${debit}, credit ${credit}`);
  return lines;
}

export interface FeeLineDraft {
  feeType: "platform_fee" | "gateway_fee";
  amountPaise: number;
  bps: number;
}

export function feeLines(split: TipSplit, rates: FeeRates = STANDARD_RATES): FeeLineDraft[] {
  return [
    { feeType: "platform_fee" as const, amountPaise: split.platformFeePaise, bps: rates.platformBps },
    { feeType: "gateway_fee" as const, amountPaise: split.processingPaise, bps: rates.processingBps },
  ].filter((l) => l.amountPaise > 0);
}
