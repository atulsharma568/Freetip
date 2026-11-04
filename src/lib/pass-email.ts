import "server-only";
import { buildReminder, type ReminderTarget, type SendResult } from "@/lib/pass-reminders";
import { SITE_URL } from "@/lib/url";

// The "your pass ends soon" email, sent through Resend's HTTP API (the same account as the contact
// form). It goes to a creator, not to us, so it needs a sender on a domain verified in Resend:
// off until RESEND_API_KEY and CONTACT_FROM_EMAIL are both set (Resend's shared test sender can
// only mail the account owner). The plans page shows the same warning on screen either way.
export async function sendPassReminderEmail(target: ReminderTarget): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  if (!key || !from) return "off";

  const { subject, text } = buildReminder(target, SITE_URL);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [target.email], subject, text }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.error("Pass reminder: email failed with status", response.status);
      return "failed";
    }
    return "sent";
  } catch (error) {
    console.error("Pass reminder: email failed.", error instanceof Error ? error.message : error);
    return "failed";
  }
}
