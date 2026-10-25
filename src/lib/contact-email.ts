import "server-only";
import type { ContactEntry } from "@/lib/contact";
import { buildNotification } from "@/lib/contact-notification";

// Plain-text email to the owner for each contact message, sent through
// Resend's HTTP API (no package needed). Off until RESEND_API_KEY and
// CONTACT_NOTIFY_EMAIL are set; the message is saved either way and a failed
// email never fails the visitor's request.
//
// The subject holds only our own topic label, never visitor text, and the
// visitor's address goes in reply_to through the JSON body, so nothing the
// visitor types can add a header or change who the mail is sent to.

export async function sendContactEmail(entry: ContactEntry): Promise<"sent" | "off" | "failed"> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_NOTIFY_EMAIL;
  if (!key || !to) return "off";

  const { subject, text } = buildNotification(entry);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        // Resend's shared test sender works until a domain is verified there.
        from: process.env.CONTACT_FROM_EMAIL || "Tipsite <onboarding@resend.dev>",
        to: [to],
        reply_to: entry.email,
        subject,
        text,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.error("Contact: email failed with status", response.status);
      return "failed";
    }
    return "sent";
  } catch (error) {
    console.error("Contact: email failed.", error instanceof Error ? error.message : error);
    return "failed";
  }
}
