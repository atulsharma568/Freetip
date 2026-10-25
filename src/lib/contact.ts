// Contact form rules, shared by the form (for its messages) and the server
// action, which checks every field again before saving anything.
import { EMAIL_PATTERN } from "@/lib/waitlist";

export const CONTACT_TOPICS = [
  { value: "general", label: "A question" },
  { value: "payment", label: "A payment problem" },
  { value: "creator", label: "My creator account" },
  { value: "report", label: "Report a page or message" },
  { value: "privacy", label: "A privacy request" },
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number]["value"];
export type ContactField = "name" | "email" | "topic" | "payment_ref" | "message";

export const CONTACT_LIMITS = { name: 100, paymentRef: 60, messageMin: 10, messageMax: 2000 };

export type ContactState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "invalid"; field: ContactField }
  | { status: "rate_limited" }
  | { status: "unavailable" };

export const CONTACT_IDLE: ContactState = { status: "idle" };

const MESSAGES: Record<ContactState["status"] | ContactField, string> = {
  idle: "",
  ok: "Thanks, your message is sent. We will reply by email.",
  invalid: "",
  name: "Enter your name (up to 100 characters).",
  email: "Enter a valid email address so we can reply.",
  topic: "Choose what your message is about.",
  payment_ref: "That payment reference looks too long. Use only the payment ID or UTR.",
  message: `Write at least ${CONTACT_LIMITS.messageMin} characters, up to ${CONTACT_LIMITS.messageMax}.`,
  rate_limited: "Too many messages from this network. Please try again in an hour, or email us.",
  unavailable: "The form isn't working right now. Please email us instead.",
};

export function contactMessage(state: ContactState) {
  return MESSAGES[state.status === "invalid" ? state.field : state.status];
}

export type ContactEntry = {
  name: string;
  email: string;
  topic: ContactTopic;
  paymentRef: string | null;
  message: string;
};

function text(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

// Control characters other than newline and tab are dropped from free text.
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

export function parseContact(
  form: FormData,
): { ok: true; entry: ContactEntry } | { ok: false; field: ContactField } {
  const name = text(form, "name").replace(CONTROL, "").replace(/\s+/g, " ");
  if (!name || name.length > CONTACT_LIMITS.name) return { ok: false, field: "name" };

  const email = text(form, "email").toLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return { ok: false, field: "email" };

  const topic = CONTACT_TOPICS.find((t) => t.value === text(form, "topic"));
  if (!topic) return { ok: false, field: "topic" };

  const paymentRef = text(form, "payment_ref").replace(CONTROL, "");
  if (paymentRef.length > CONTACT_LIMITS.paymentRef) return { ok: false, field: "payment_ref" };

  const message = text(form, "message").replace(/\r\n?/g, "\n").replace(CONTROL, "");
  if (message.length < CONTACT_LIMITS.messageMin || message.length > CONTACT_LIMITS.messageMax) {
    return { ok: false, field: "message" };
  }

  return {
    ok: true,
    entry: { name, email, topic: topic.value, paymentRef: paymentRef || null, message },
  };
}
