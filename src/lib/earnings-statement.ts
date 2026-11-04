import { csvCell, formatIst } from "./earnings";
import { holdEndsAt } from "./balances";
import { splitTip, type FeeRates } from "./money";

// The creator's statement: one row per live tip that has been posted to the books, with what the
// fan paid, our fee, the processing charge and what the creator keeps. The creator's share is the
// ledger's own figure (a tip Razorpay took back nets to nothing); the two charges are worked from the
// pair saved on the order, the same rule every real tip is split by. No database and no site imports,
// so the page, the export and the tests share one answer.

export type StatementStatus = "held" | "released" | "reversed";

export interface StatementRow {
  tipId: number;
  capturedAt: Date;
  name: string;
  grossPaise: number;
  platformFeePaise: number;
  processingPaise: number;
  // What the ledger holds for this tip on the creator's account (credits minus debits).
  netPaise: number;
  status: StatementStatus;
  // When a held tip frees up; null once it has.
  releasesAt: Date | null;
}

export interface StatementInput {
  tipId: number;
  capturedAt: Date;
  fanName: string | null;
  grossPaise: number;
  rates: FeeRates;
  netPaise: number;
  method: string | null;
}

export function toStatementRow(t: StatementInput, hasCompletedPayout: boolean, now: Date): StatementRow {
  const split = splitTip(t.grossPaise, t.rates);
  const base = {
    tipId: t.tipId,
    capturedAt: t.capturedAt,
    name: t.fanName?.trim() || "Anonymous",
    grossPaise: t.grossPaise,
    platformFeePaise: split.platformFeePaise,
    processingPaise: split.processingPaise,
    netPaise: t.netPaise,
  };
  if (t.netPaise <= 0) return { ...base, status: "reversed", releasesAt: null };
  const ends = holdEndsAt(t.capturedAt, t.method, hasCompletedPayout);
  return ends.getTime() > now.getTime()
    ? { ...base, status: "held", releasesAt: ends }
    : { ...base, status: "released", releasesAt: null };
}

const plain = (paise: number) => (paise / 100).toFixed(2);

const STATUS_WORDS: Record<StatementStatus, string> = {
  held: "Pending",
  released: "Released",
  reversed: "Reversed",
};

export function statusWord(status: StatementStatus): string {
  return STATUS_WORDS[status];
}

// Amounts are plain numbers so a spreadsheet can sum them. Every cell goes through the same formula
// guard as the tips export, since a fan's name is typed text.
export function statementCsv(rows: StatementRow[]): string {
  const header = [
    "Date (IST)",
    "Fan",
    "Tip (INR)",
    "Freetip fee (INR)",
    "Processing charge (INR)",
    "You keep (INR)",
    "Status",
    "Pending until (IST)",
  ];
  const lines = rows.map((r) =>
    [
      formatIst(r.capturedAt),
      r.name,
      plain(r.grossPaise),
      plain(r.platformFeePaise),
      plain(r.processingPaise),
      plain(r.netPaise),
      statusWord(r.status),
      r.releasesAt ? formatIst(r.releasesAt) : "",
    ]
      .map(csvCell)
      .join(","),
  );
  return "\uFEFF" + [header.join(","), ...lines].join("\r\n") + "\r\n";
}
