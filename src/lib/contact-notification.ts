import { CONTACT_TOPICS, type ContactEntry } from "@/lib/contact";

// The text of the email to the owner for a contact message (sent by
// contact-email.ts). The subject holds only our own topic label, never visitor text.
export function buildNotification(entry: ContactEntry) {
  const topic = CONTACT_TOPICS.find((t) => t.value === entry.topic)?.label ?? entry.topic;
  const lines = [
    `From: ${entry.name} <${entry.email}>`,
    `About: ${topic}`,
    ...(entry.paymentRef ? [`Payment reference: ${entry.paymentRef}`] : []),
    "",
    entry.message,
    "",
    "Reply to this email to answer them. Mark it handled in /admin/messages.",
  ];
  return { subject: `New contact message: ${topic}`, text: lines.join("\n") };
}
