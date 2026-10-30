import { PLATFORM_BPS, PROCESSING_BPS, splitTip } from "./money";

// Operator details for the legal, contact and pricing pages. Empty values
// render as visible [bracketed] placeholders (see <Fill>), so nothing is
// guessed. Fill these in before launch and before applying to Razorpay.
export const OPERATOR = {
  legalName: "",
  businessType: "", // e.g. "private limited company", "LLP", "sole proprietorship"
  registeredAddress: "",
  courtCity: "", // city whose courts handle disputes
  supportEmail: "",
  phone: "",
  hours: "", // e.g. "Monday to Friday, 10:00 to 18:00 IST"
  grievanceOfficer: "",
  grievanceDesignation: "",
  grievanceEmail: "",
  gstin: "", // leave empty if not registered for GST
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

// Shown on every legal page until the details above are filled in and a
// lawyer has reviewed the text.
export const LEGAL_DRAFT = true;

// Draft policy pages ask search engines not to index them.
export const LEGAL_ROBOTS = LEGAL_DRAFT ? { index: false, follow: true } : undefined;

export const LEGAL_UPDATED = "30 October 2026";

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
  example: { tip: "₹100.00", platform: "−₹5.00", gateway: "−₹2.50", keep: "₹92.50" },
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
  { name: "Vercel", role: "website hosting and the sound files creators upload", status: "active" },
  { name: "Neon", role: "database (waitlist entries and contact messages now; accounts and tips later)", status: "active" },
  { name: "Resend", role: "emailing us a copy of each contact message (your name, email and message pass through it)", status: "planned" },
  { name: "Amazon Web Services (Polly)", role: "reading a tip's message aloud on a creator's stream (the message text only)", status: "planned" },
];
