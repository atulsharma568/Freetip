import { formatRupees } from "./earnings";
import { payoutRef } from "./payouts";

// The text of the email to the owner when a creator asks for a payout (sent by payout-email.ts). Only
// what the owner needs to open the page: the UPI ID stays in /admin/payouts, never in an email.
export function buildPayoutRequestEmail(o: {
  creatorName: string | null;
  handle: string | null;
  payoutId: number;
  amountPaise: number;
  firstPayout: boolean;
  adminUrl: string;
}) {
  const ref = payoutRef(o.payoutId);
  const who = [o.creatorName?.trim() || "A creator", o.handle ? `(@${o.handle})` : ""].filter(Boolean).join(" ");
  return {
    // Our own words and numbers only: nothing a creator typed goes in the subject.
    subject: `Payout request ${ref}: ${formatRupees(o.amountPaise)}`,
    text: [
      `${who} asked for a payout of ${formatRupees(o.amountPaise)}.`,
      `Reference: ${ref}${o.firstPayout ? " (their first payout)" : ""}`,
      "",
      "Pay it from your bank or UPI app to the UPI ID shown on the page, then record the UTR there:",
      o.adminUrl,
      "",
      "Put the reference in the payment note if your app has one.",
    ].join("\n"),
  };
}

// A request waiting this many whole days or more is nudged about, once a day, until it is paid or cancelled.
export const NUDGE_AFTER_DAYS = 3;

// The daily nudge to the owner about payout requests that have waited. References, amounts and days
// only: no name and no UPI ID, so nothing a creator typed reaches a header or a mailbox.
export function buildPayoutNudgeEmail(o: {
  waiting: { payoutId: number; amountPaise: number; waitedDays: number }[];
  adminUrl: string;
}) {
  const total = o.waiting.reduce((sum, w) => sum + w.amountPaise, 0);
  const n = o.waiting.length;
  return {
    subject: `${n} payout ${n === 1 ? "request is" : "requests are"} still waiting: ${formatRupees(total)}`,
    text: [
      `${n === 1 ? "A creator has" : `${n} creators have`} been waiting ${NUDGE_AFTER_DAYS} days or more to be paid:`,
      "",
      ...o.waiting.map((w) => `${payoutRef(w.payoutId)}: ${formatRupees(w.amountPaise)}, waiting ${w.waitedDays} days`),
      "",
      "Pay them, or cancel with a reason if you will not:",
      o.adminUrl,
      "",
      "This email comes once a day while any request is still open this long.",
    ].join("\n"),
  };
}
