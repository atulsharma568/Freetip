import { formatRupees } from "./earnings";
import { payoutRef } from "./payouts";

export interface DailyPayoutLine {
  payoutId: number;
  amountPaise: number;
  // Whole days since the payout was started (0 for one started this morning).
  waitedDays: number;
  firstPayout: boolean;
}

// The morning email to the owner (sent by payout-email.ts): every payout waiting to be paid, the ones
// started today and the ones still open from before. References, amounts and days only: the creator's
// name and UPI ID stay in /admin/payouts, so nothing a creator typed reaches a header or a mailbox.
export function buildDailyPayoutEmail(o: { lines: DailyPayoutLine[]; startedToday: number; adminUrl: string }) {
  const total = o.lines.reduce((sum, w) => sum + w.amountPaise, 0);
  const n = o.lines.length;
  const older = n - o.startedToday;
  return {
    subject: `Pay ${n} ${n === 1 ? "creator" : "creators"} today: ${formatRupees(total)}`,
    text: [
      `${n === 1 ? "One payout is" : `${n} payouts are`} waiting to be paid, ${formatRupees(total)} in all` +
        (older > 0 ? ` (${o.startedToday} new today, ${older} from earlier days).` : "."),
      "",
      ...o.lines.map(
        (w) =>
          `${payoutRef(w.payoutId)}: ${formatRupees(w.amountPaise)}` +
          (w.firstPayout ? " (first payout)" : "") +
          (w.waitedDays >= 1 ? `, waiting ${w.waitedDays} ${w.waitedDays === 1 ? "day" : "days"}` : ""),
      ),
      "",
      "Pay each one from your bank or UPI app to the UPI ID shown on the page, then record the UTR there:",
      o.adminUrl,
      "",
      "Put the reference in the payment note if your app has one. This email comes every morning while any payout is waiting.",
    ].join("\n"),
  };
}
