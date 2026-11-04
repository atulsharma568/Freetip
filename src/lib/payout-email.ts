import "server-only";
import { buildPayoutRequestEmail } from "@/lib/payout-notification";

// Emails the owner when a creator requests a payout, through Resend's HTTP API (the same setup as the
// contact form: RESEND_API_KEY and CONTACT_NOTIFY_EMAIL). Off until those are set. A failed email never
// fails the request: the request is saved either way and waits in /admin/payouts.
export async function sendPayoutRequestEmail(o: {
  creatorName: string | null;
  handle: string | null;
  payoutId: number;
  amountPaise: number;
  firstPayout: boolean;
}): Promise<"sent" | "off" | "failed"> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_NOTIFY_EMAIL;
  if (!key || !to) return "off";

  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://freetip.in").replace(/\/+$/, "");
  const { subject, text } = buildPayoutRequestEmail({ ...o, adminUrl: `${site}/admin/payouts` });
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
