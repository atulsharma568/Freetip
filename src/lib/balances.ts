// What a creator can be paid, worked out from the ledger (payout design, section 4.6).
// No database and no site imports, so the admin page and the tests share one answer.
//
//   balance    creator_payable credit minus debit (can be negative)
//   held       the net of each tip still inside its hold
//   available  balance minus held, never below zero
//
// A tip's hold starts at capture and depends on how it was paid: 1 day for UPI
// (owner, 2026-11-04, so a day's earnings can be paid the next day), 30 for
// anything else (card, netbanking, wallet, or a method we never recorded);
// a creator with no completed payout waits 60 days on non-UPI tips, since a new
// creator is the likeliest chargeback. The other numbers are the owner-approved
// defaults in docs/payout-design.md section 3.
export const MIN_PAYOUT_PAISE = 50_000; // ₹500
export const HOLD_DAYS_UPI = 1;
export const HOLD_DAYS_OTHER = 30;
export const HOLD_DAYS_NEW_CREATOR = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

export function holdDays(method: string | null, hasCompletedPayout: boolean): number {
  if (method === "upi") return HOLD_DAYS_UPI;
  return hasCompletedPayout ? HOLD_DAYS_OTHER : HOLD_DAYS_NEW_CREATOR;
}

export function holdEndsAt(capturedAt: Date, method: string | null, hasCompletedPayout: boolean): Date {
  return new Date(capturedAt.getTime() + holdDays(method, hasCompletedPayout) * DAY_MS);
}

export interface TipForHold {
  capturedAt: Date;
  method: string | null;
  // What the ledger holds for this tip on the creator's account (credits minus
  // debits, so a tip taken back by Razorpay nets to zero and is not held twice).
  netPaise: number;
}

export interface Balance {
  balancePaise: number;
  heldPaise: number;
  availablePaise: number;
  // When the first held tip frees up, or null if nothing is held.
  nextReleaseAt: Date | null;
}

export function workOutBalance(
  balancePaise: number,
  tips: TipForHold[],
  hasCompletedPayout: boolean,
  now: Date,
): Balance {
  let heldPaise = 0;
  let nextReleaseAt: Date | null = null;
  for (const tip of tips) {
    if (tip.netPaise <= 0) continue;
    const ends = holdEndsAt(tip.capturedAt, tip.method, hasCompletedPayout);
    if (ends.getTime() <= now.getTime()) continue;
    heldPaise += tip.netPaise;
    if (!nextReleaseAt || ends.getTime() < nextReleaseAt.getTime()) nextReleaseAt = ends;
  }
  // Held money is part of the balance; when a negative balance or a payout has
  // already used it up there is nothing left to pay.
  const availablePaise = Math.max(0, balancePaise - heldPaise);
  return { balancePaise, heldPaise, availablePaise, nextReleaseAt };
}

// The longest any hold can last: tips captured earlier than this are never held.
export const LONGEST_HOLD_DAYS = Math.max(HOLD_DAYS_UPI, HOLD_DAYS_OTHER, HOLD_DAYS_NEW_CREATOR);
