import "server-only";
import { getDb } from "@/lib/db";
import { getNotifyEmail } from "@/lib/site-settings";
import type { ContactEntry } from "@/lib/contact";
import { buildNotification, buildReceipt } from "@/lib/contact-notification";

// Plain-text email to the owner for each contact message, sent through
// Resend's HTTP API (no package needed). Off until RESEND_API_KEY and an address to send to are set
// (the one saved in /admin/settings, else CONTACT_NOTIFY_EMAIL); the message is saved either way and a failed
// email never fails the visitor's request.
//
// The subject holds only our own topic label, never visitor text, and the
// visitor's address goes in reply_to through the JSON body, so nothing the
// visitor types can add a header or change who the mail is sent to.

export async function sendContactEmail(entry: ContactEntry, ticket?: string): Promise<"sent" | "off" | "failed"> {
  const key = process.env.RESEND_API_KEY;
  const to = await getNotifyEmail(getDb());
  if (!key || !to) return "off";

  const { subject, text } = buildNotification(entry, ticket);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        // Resend's shared test sender works until a domain is verified there.
        from: process.env.CONTACT_FROM_EMAIL || "Freetip <onboarding@resend.dev>",
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

// A receipt to the person who wrote, with their ticket number. Resend's shared test
// sender may only mail the account owner, so this stays off until CONTACT_FROM_EMAIL
// is set to an address on a domain verified in Resend. The page shows the ticket
// either way.
export async function sendContactReceipt(entry: ContactEntry, ticket: string): Promise<"sent" | "off" | "failed"> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  if (!key || !from) return "off";

  const { subject, text } = buildReceipt(ticket);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [entry.email], subject, text }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.error("Contact: receipt failed with status", response.status);
      return "failed";
    }
    return "sent";
  } catch (error) {
    console.error("Contact: receipt failed.", error instanceof Error ? error.message : error);
    return "failed";
  }
}
