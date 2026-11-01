import { CONTACT_TOPICS, type ContactEntry } from "@/lib/contact";

// The text of the email to the owner for a contact message (sent by
// contact-email.ts). The subject holds only our own topic label, never visitor text.
export function buildNotification(entry: ContactEntry, ticket?: string) {
  const topic = CONTACT_TOPICS.find((t) => t.value === entry.topic)?.label ?? entry.topic;
  const lines = [
    ...(ticket ? [`Ticket: ${ticket}`] : []),
    `From: ${entry.name} <${entry.email}>`,
    `About: ${topic}`,
    ...(entry.paymentRef ? [`Payment reference: ${entry.paymentRef}`] : []),
    "",
    entry.message,
    "",
    "Reply to this email to answer them. Mark it handled in /admin/messages.",
  ];
  return { subject: `New contact message${ticket ? ` ${ticket}` : ""}: ${topic}`, text: lines.join("\n") };
}

// The receipt emailed to the sender. Only our own words and the ticket number:
// nothing the visitor typed is repeated in it.
export function buildReceipt(ticket: string) {
  return {
    subject: `We got your message (${ticket})`,
    text: [
      "Hello,",
      "",
      `We received your message to Freetip. Your ticket number is ${ticket}. Quote it if you write to us again.`,
      "",
      "We read every message by hand and will reply to this email address. A complaint is acknowledged within 24 hours.",
      "",
      "We will never ask for your UPI PIN, card PIN, OTP or full card number. If you did not send this message, you can ignore this email.",
      "",
      "Freetip",
    ].join("\n"),
  };
}
