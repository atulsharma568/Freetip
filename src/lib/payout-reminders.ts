import type { LedgerDb } from "./accrual";
import { listOpenPayouts } from "./admin/payout-queries";
import { NUDGE_AFTER_DAYS } from "./payout-notification";

// The daily nudge to the owner about payout requests left unpaid. No state is kept: every run emails
// the requests open for NUDGE_AFTER_DAYS or more, so the owner hears each day until they are paid or
// cancelled. No site imports and no `server-only`: the sender is passed in, so the tests run it
// against an in-memory Postgres with a pretend sender.

export type NudgeSend = (waiting: { payoutId: number; amountPaise: number; waitedDays: number }[]) => Promise<"sent" | "off" | "failed">;

export interface NudgeResult {
  waiting: number;
  sent: boolean;
  off: boolean;
}

export async function sendPayoutNudge(db: LedgerDb, send: NudgeSend, now = new Date()): Promise<NudgeResult> {
  const open = await listOpenPayouts(db, now);
  if (!open.ok) throw new Error("payout requests could not be read");
  const waiting = open.data.rows
    .filter((r) => r.waitedDays >= NUDGE_AFTER_DAYS)
    .map((r) => ({ payoutId: r.id, amountPaise: r.amountMinor, waitedDays: r.waitedDays }));
  if (waiting.length === 0) return { waiting: 0, sent: false, off: false };
  const result = await send(waiting);
  return { waiting: waiting.length, sent: result === "sent", off: result === "off" };
}
