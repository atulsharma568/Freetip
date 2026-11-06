import type { LedgerDb } from "./accrual";
import { listOpenPayouts } from "./admin/payout-queries";
import type { DailyPayoutLine } from "./payout-notification";
import { startDailyPayouts } from "./payouts";

// The morning payout run: start a payout for every creator with at least the minimum available, then
// email the owner one list of everything waiting to be paid (new today and still open from before).
// No state is kept for the email: every run lists what is open, so the owner hears each morning until
// each payout is paid or cancelled. No site imports and no `server-only`: the sender is passed in, so
// the tests run it against an in-memory Postgres with a pretend sender.

export type DailySend = (lines: DailyPayoutLine[], startedToday: number) => Promise<"sent" | "off" | "failed">;

export interface DailyResult {
  started: number;
  waiting: number;
  totalPaise: number;
  belowMinimum: number;
  errors: number;
  sent: boolean;
  off: boolean;
}

export async function runDailyPayouts(db: LedgerDb, send: DailySend, now = new Date()): Promise<DailyResult> {
  const run = await startDailyPayouts(db, now);
  const open = await listOpenPayouts(db, now);
  if (!open.ok) throw new Error("payouts could not be read");
  const lines = open.data.rows.map((r) => ({
    payoutId: r.id,
    amountPaise: r.amountMinor,
    waitedDays: r.waitedDays,
    firstPayout: r.firstPayout,
  }));
  const base = {
    started: run.started.length,
    waiting: lines.length,
    totalPaise: lines.reduce((s, l) => s + l.amountPaise, 0),
    belowMinimum: run.belowMinimum,
    errors: run.errors,
  };
  if (lines.length === 0) return { ...base, sent: false, off: false };
  const result = await send(lines, run.started.length);
  return { ...base, sent: result === "sent", off: result === "off" };
}
