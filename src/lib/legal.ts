import { PLATFORM_BPS, PROCESSING_BPS, splitTip } from "./money";
import { LIVE_SALES_OPEN } from "./pricing";

// Operator details for the legal, contact and pricing pages. Empty values
// render as visible [bracketed] placeholders (see <Fill>), so nothing is
// guessed. Fill these in before launch and before applying to Razorpay.
export const OPERATOR = {
  legalName: "Atul Sharma",
  businessType: "sole proprietorship", // e.g. "private limited company", "LLP", "sole proprietorship"
  registeredAddress: "Bengaluru, Karnataka, India (an online-only business with no public office)",
  courtCity: "Bengaluru", // city whose courts handle disputes
  supportEmail: "",
  phone: "",
  hours: "", // e.g. "Monday to Friday, 10:00 to 18:00 IST"
  grievanceOfficer: "Atul Sharma",
  grievanceDesignation: "Founder",
  grievanceEmail: "",
  gstin: "", // empty means "Not registered for GST" on the pages (owner, 2026-11-01)
  dataRegion: "Singapore (AWS ap-southeast-1)", // where the database and server run
};

export type OperatorKey = keyof typeof OPERATOR;

export const PLACEHOLDER: Record<OperatorKey, string> = {
  legalName: "Legal name",
  businessType: "Business type",
  registeredAddress: "Registered address",
  courtCity: "City",
  supportEmail: "Support email",
  phone: "Phone number",
  hours: "Support hours",
  grievanceOfficer: "Grievance Officer's name",
  grievanceDesignation: "Designation",
  grievanceEmail: "Grievance email",
  gstin: "GSTIN, if registered",
  dataRegion: "Data region",
};

// True shows the draft banner on every legal page and keeps them out of search.
// Turned off by the owner on 2026-11-01 without a legal review (no budget).
export const LEGAL_DRAFT = false;

// Draft policy pages ask search engines not to index them.
export const LEGAL_ROBOTS = LEGAL_DRAFT ? { index: false, follow: true } : undefined;

// The date shown at the top of the Terms and Refund Policy. Change it with any edit of their wording.
export const LEGAL_UPDATED = "6 November 2026";

// The version of the paid-plan text a creator agrees to by ticking the box. Every paid-plan order
// stores it (plan_orders.terms_version) as the proof of which words they agreed to. Unlike
// LEGAL_UPDATED it is not shown to anyone and changes with EVERY edit of the wording the creator sees
// when buying: the Terms, the Refund Policy, the pricing page and the tick box in BuyPass.tsx. The
// test in test/legal-version.spec.ts fails until it is changed, so an edit cannot go out under an old
// version (OPERATIONS.md 7i). At most 40 characters.
export const TERMS_VERSION = "6 November 2026, text 8";

// Saved with each waitlist entry. Change it whenever the privacy policy's
// waitlist sections change, so we know which notice each person agreed to.
export const WAITLIST_CONSENT_VERSION = "privacy-2026-10-16";

// The rates and the worked example shared by the home page, the pricing page,
// the terms and the dashboard. The rules themselves live in `money.ts`
// (basis points, rounded half up to the paise); the percentages here are
// derived from them so a rate change is made in one place. The processing
// charge is our own flat charge, taken from the creator's payout on top of the
// platform fee. Fans pay exactly the tip. If a rate changes, change `money.ts`,
// then update `example` below (the unit test fails until it matches).
export const FEES = {
  platformPercent: PLATFORM_BPS / 100,
  gatewayPercent: PROCESSING_BPS / 100,
  example: { tip: "₹100.00", platform: "−₹5.00", gateway: "−₹3.00", keep: "₹92.00" },
};

const money = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// The same worked example for any whole-rupee tip, worked in whole paise by
// `splitTip` so nothing drifts: our platform fee and the processing charge,
// each rounded half up to the paise, come out of the payout.
// `feeBreakdown(100)` matches `FEES.example`. Tips are positive, so a zero or
// negative amount throws, as `splitTip` does.
export function feeBreakdown(rupees: number) {
  const { grossPaise, platformFeePaise, processingPaise, creatorSharePaise } = splitTip(
    Math.round(rupees * 100),
  );
  return {
    tip: money(grossPaise),
    platform: `−${money(platformFeePaise)}`,
    gateway: `−${money(processingPaise)}`,
    keep: money(creatorSharePaise),
  };
}

// Services that process personal data for us. "planned" ones are not used yet.
export const PROCESSORS = [
  { name: "Payment processor", role: "payments, refunds and payouts", status: "planned" },
  { name: "Payment provider for paid features passes", role: "taking a creator's payment for a paid features pass (the creator's name and email address, the amount and our order reference; the provider handles the card, UPI or net banking details itself and we never see them)", status: LIVE_SALES_OPEN ? "active" : "planned" }, // live once creators can buy
  { name: "Vercel", role: "website hosting and the sound files creators upload", status: "active" },
  { name: "Neon", role: "database (creator accounts, tips, saved stream timestamps, waitlist entries and contact messages)", status: "active" },
  { name: "Resend", role: "emailing us a copy of each contact message (your name, email and message pass through it), and emailing a creator a reminder before a paid features pass ends (their name and email)", status: "planned" },
  { name: "Microsoft Azure (Speech)", role: "reading a tip's message aloud on a creator's stream (the message text only)", status: "planned" },
  { name: "Google (YouTube)", role: "posting a creator's stream timestamps as a comment on their own stream, only if the creator connects their channel for it", status: "planned" },
  { name: "Discord", role: "sending each saved stream timestamp to a Discord channel the creator chose, only if the creator connects a webhook (the viewer's chat name, what they typed, and the time)", status: "planned" },
  { name: "Streamlabs", role: "showing a tip as an alert in a creator's own Streamlabs alert box, only if the creator connects their Streamlabs account (the fan's name, the amount and, when it would show on the creator's stream, the message)", status: "planned" },
  { name: "Amazon Web Services (Polly)", role: "reading a message aloud when Azure is unavailable (the message text only)", status: "planned" },
];
