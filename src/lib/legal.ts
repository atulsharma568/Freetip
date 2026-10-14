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
  dataRegion: "", // where the database runs, e.g. "Mumbai, India (AWS ap-south-1)"
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
export const LEGAL_UPDATED = "14 October 2026";

// Fee example shared by the home page, the pricing page and the terms.
// Razorpay's standard rate (Oct 2026): 2% of each domestic payment plus 18%
// GST on that charge; international cards up to 3%.
export const FEES = {
  platformPercent: 5,
  gatewayPercent: 2,
  gatewayGstPercent: 18,
  example: { tip: "₹100.00", platform: "−₹5.00", gateway: "−₹2.36", keep: "₹92.64" },
};

// Services that process personal data for us. "planned" ones are not used yet.
export const PROCESSORS = [
  { name: "Razorpay", role: "payments, refunds and payouts", status: "planned" },
  { name: "Vercel", role: "website hosting", status: "planned" },
  { name: "Neon", role: "database (waitlist entries now; accounts and tips later)", status: "planned" },
];
