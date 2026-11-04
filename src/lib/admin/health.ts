import vercel from "../../../vercel.json";

// What the owner's health page lists: the scheduled jobs and the settings the
// server needs. Names and "is it set" only. A value is never read into anything
// the page renders.

export interface CronJob {
  path: string;
  // The Vercel schedule (UTC), or null when no schedule is in vercel.json.
  schedule: string | null;
  what: string;
  // Needs a second scheduler outside Vercel (the free plan only allows daily crons).
  note?: string;
}

const WHAT: Record<string, { what: string; note?: string }> = {
  "/api/cron/waitlist-purge": { what: "Clears old waitlist and rate-limit rows." },
  "/api/cron/sound-orphans": { what: "Removes sound files nobody uses." },
  "/api/cron/tts-cache-purge": { what: "Clears old voice clips." },
  "/api/cron/tts-learn": { what: "Voice auto-learning. Does nothing while parked." },
  "/api/cron/accrual-sweep": { what: "Posts missed tips to the ledger." },
  "/api/cron/goal-periods": { what: "Records the finished day, week or month of each repeating goal bar." },
  "/api/cron/tip-text-purge": {
    what: "Blanks fan names and messages after 90 days; deletes handled contact messages after 12 months and old stream timestamps.",
  },
  "/api/cron/stream-timestamps": {
    what: "Posts the timestamp comment on each stream that has ended.",
    note: "Daily is too slow: also call it every 10 minutes from a free outside scheduler with the CRON_SECRET header (OPERATIONS.md section 7).",
  },
  "/api/cron/streamlabs-outbox": {
    what: "Sends the Streamlabs alerts still waiting (a message awaiting approval, a spaced-out alert, a retry).",
    note: "Each tip is also sent straight after it is paid; for waiting alerts to go out on time, also call it every 2 minutes from a free outside scheduler with the CRON_SECRET header (OPERATIONS.md section 7).",
  },
  "/api/cron/payout-reminder": {
    what: "Emails you once a day while a creator's payout request has waited 3 days or more.",
    note: "Needs RESEND_API_KEY and CONTACT_NOTIFY_EMAIL; without them nothing is sent and the request still shows on Payouts to pay.",
  },
  "/api/cron/plan-orders": {
    what: "Checks paid-feature orders left pending against PayU, takes away the features of passes that have ended (only the ones the pass added), and emails creators whose pass ends within 5 days.",
    note: "Daily is enough: a payment is normally settled at once by PayU's return or notice; this catches the rest and ends passes. Reminders need RESEND_API_KEY and CONTACT_FROM_EMAIL (a sender on a domain verified in Resend); until then the plans page shows the warning on screen only.",
  },
};

export function cronJobs(): CronJob[] {
  const scheduled = new Map(vercel.crons.map((c) => [c.path, c.schedule] as const));
  const paths = [...new Set([...scheduled.keys(), ...Object.keys(WHAT)])].sort();
  return paths.map((path) => ({
    path,
    schedule: scheduled.get(path) ?? null,
    what: WHAT[path]?.what ?? "No description written yet.",
    note: WHAT[path]?.note,
  }));
}

// "17 3 * * *" -> "03:17 UTC daily" for the plain daily jobs, otherwise the raw expression.
export function describeSchedule(expr: string): string {
  const m = /^(\d{1,2}) (\d{1,2}) \* \* \*$/.exec(expr);
  if (!m) return expr;
  return `${m[2].padStart(2, "0")}:${m[1].padStart(2, "0")} UTC daily`;
}

export interface EnvVar {
  name: string;
  // The site cannot do its job without it.
  required: boolean;
  what: string;
  // Parked by the owner: set means something is wrong.
  parked?: boolean;
}

export const ENV_GROUPS: { title: string; vars: EnvVar[] }[] = [
  {
    title: "Core",
    vars: [
      { name: "DATABASE_URL", required: true, what: "Neon pooled connection string" },
      { name: "AUTH_SECRET", required: true, what: "Signs sign-in sessions" },
      { name: "AUTH_URL", required: false, what: "The site address for sign-in" },
      { name: "AUTH_GOOGLE_ID", required: true, what: "Google sign-in" },
      { name: "AUTH_GOOGLE_SECRET", required: true, what: "Google sign-in" },
      { name: "OWNER_GOOGLE_IDS", required: true, what: "Who may open this console" },
      { name: "CRON_SECRET", required: true, what: "Protects the cron endpoints" },
      { name: "WAITLIST_SALT", required: true, what: "Hashes waitlist and rate-limit keys" },
      { name: "NEXT_PUBLIC_SITE_URL", required: false, what: "Lets search engines in; turns on redirects and schema" },
    ],
  },
  {
    title: "Payments",
    vars: [
      { name: "RAZORPAY_KEY_ID", required: true, what: "Payments (rzp_live_ for real money)" },
      { name: "RAZORPAY_KEY_SECRET", required: true, what: "Payments" },
      { name: "RAZORPAY_WEBHOOK_SECRET", required: true, what: "Checks Razorpay's webhook calls" },
    ],
  },
  {
    title: "Files and email",
    vars: [
      { name: "BLOB_READ_WRITE_TOKEN", required: true, what: "Sound uploads (Vercel Blob)" },
      { name: "RESEND_API_KEY", required: false, what: "Emails the contact form to you" },
      { name: "CONTACT_NOTIFY_EMAIL", required: false, what: "Where those emails go" },
      { name: "CONTACT_FROM_EMAIL", required: false, what: "Sender address on a domain verified in Resend (optional; the 'your pass ends soon' email to creators needs it)" },
    ],
  },
  {
    title: "Voice",
    vars: [
      { name: "TTS_ENABLED", required: false, what: "Owner switch for voice on the whole site" },
      { name: "AZURE_SPEECH_KEY", required: false, what: "Main voice engine" },
      { name: "AZURE_SPEECH_REGION", required: false, what: "Main voice engine" },
      { name: "POLLY_ACCESS_KEY_ID", required: false, what: "Fallback voice engine" },
      { name: "POLLY_SECRET_ACCESS_KEY", required: false, what: "Fallback voice engine" },
      { name: "TTS_AUTOLEARN", required: false, what: "Voice auto-learning (parked: leave unset)", parked: true },
      { name: "ANTHROPIC_API_KEY", required: false, what: "Voice auto-learning (parked: leave unset)", parked: true },
    ],
  },
  {
    title: "Stream timestamps and analytics",
    vars: [
      { name: "YT_DATA_API_KEY", required: false, what: "YouTube lookups for stream timestamps" },
      { name: "YT_TOKEN_KEY", required: false, what: "Encrypts creators' YouTube and Discord details" },
      { name: "NEXT_PUBLIC_GA_ID", required: false, what: "Google Analytics (not set yet is fine)" },
    ],
  },
  {
    title: "PayU (buying paid features)",
    vars: [
      { name: "PAYU_KEY", required: false, what: "PayU merchant key (the Buy button needs it)" },
      { name: "PAYU_SALT", required: false, what: "PayU salt: signs and checks every payment (the Buy button needs it)" },
      { name: "PAYU_MODE", required: false, what: "live or test; anything else means test" },
    ],
  },
  {
    title: "Streamlabs bridge",
    vars: [
      { name: "STREAMLABS_CLIENT_ID", required: false, what: "Streamlabs app id (connecting needs it)" },
      { name: "STREAMLABS_CLIENT_SECRET", required: false, what: "Streamlabs app secret (connecting needs it)" },
    ],
  },
];

export interface EnvStatus extends EnvVar {
  set: boolean;
}

// Whether each variable is set (non-empty). Never returns a value.
export function envStatus(env: Record<string, string | undefined> = process.env): { title: string; vars: EnvStatus[] }[] {
  return ENV_GROUPS.map((g) => ({
    title: g.title,
    vars: g.vars.map((v) => ({ ...v, set: (env[v.name] ?? "").trim() !== "" })),
  }));
}
