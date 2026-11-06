import "server-only";
import { buildDailyPayoutEmail, type DailyPayoutLine } from "@/lib/payout-notification";

// Emails the owner the morning list of payouts to pay, through Resend's HTTP API (the same setup as the
// contact form: RESEND_API_KEY and CONTACT_NOTIFY_EMAIL). Off until those are set. A failed email never
// undoes anything: the payouts are saved either way and wait in /admin/payouts.
export function sendDailyPayoutEmail(lines: DailyPayoutLine[], startedToday: number) {
  return sendToOwner((adminUrl) => buildDailyPayoutEmail({ lines, startedToday, adminUrl }));
}

async function sendToOwner(build: (adminUrl: string) => { subject: string; text: string }): Promise<"sent" | "off" | "failed"> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_NOTIFY_EMAIL;
  if (!key || !to) return "off";

  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://freetip.in").replace(/\/+$/, "");
  const { subject, text } = build(`${site}/admin/payouts`);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM_EMAIL || "Freetip <onboarding@resend.dev>",
        to: [to],
        subject,
        text,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.error("Payout: email failed with status", response.status);
      return "failed";
    }
    return "sent";
  } catch (error) {
    console.error("Payout: email failed.", error instanceof Error ? error.message : error);
    return "failed";
  }
}
