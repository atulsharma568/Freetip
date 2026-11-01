// The money rules, in one place: no database, no site imports, so the browser,
// the server and the tests all work out the same numbers. Amounts are whole
// paise (integers); anything a database hands back as a string goes through
// `toPaise` once, at the edge.
//
// A tip is split into our platform fee and a flat processing charge (owner's
// choice, 2026-10-30), each worked in basis points and rounded half up to the
// paise. The creator keeps what is left. `RULE_VERSION` is saved with every fee
// line so a later change of rate never rewrites an old tip.
export const RULE_VERSION = "2026-10-30.2";
export const PLATFORM_BPS = 500; // 5%
// The smallest tip, the same for every creator (owner, 2026-11-01).
export const MIN_TIP_PAISE = 2000;
export const PROCESSING_BPS = 275; // 2.75%, shown as Freetip's processing charge

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

export function splitTip(grossPaise: number): TipSplit {
  if (!Number.isSafeInteger(grossPaise) || grossPaise <= 0) {
    throw new RangeError(`A tip must be a positive whole number of paise: ${grossPaise}`);
  }
  const platformFeePaise = cut(grossPaise, PLATFORM_BPS);
  const processingPaise = cut(grossPaise, PROCESSING_BPS);
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

export function feeLines(split: TipSplit): FeeLineDraft[] {
  return [
    { feeType: "platform_fee" as const, amountPaise: split.platformFeePaise, bps: PLATFORM_BPS },
    { feeType: "gateway_fee" as const, amountPaise: split.processingPaise, bps: PROCESSING_BPS },
  ].filter((l) => l.amountPaise > 0);
}
