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
