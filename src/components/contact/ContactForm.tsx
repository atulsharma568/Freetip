"use client";

import { useActionState, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { sendContact } from "@/app/actions/contact";
import { TickLoader } from "@/components/ui/TickLoader";
import {
  CONTACT_IDLE,
  CONTACT_LIMITS,
  CONTACT_TOPICS,
  contactMessage,
  type ContactField,
} from "@/lib/contact";

const FIELD =
  "w-full rounded-[var(--radius-field)] border border-control bg-ground px-4 text-base text-text placeholder:text-muted/70 focus:border-accent focus:outline-none transition-[border-color] aria-[invalid=true]:border-red-400";

const IDS: Record<ContactField, string> = {
  name: "contact-name",
  email: "contact-email",
  topic: "contact-topic",
  payment_ref: "contact-payment",
  message: "contact-message",
};

// The contact form. The server's answer shows until the person edits a field
// again, and a field it rejects gets focus back.
export function ContactForm() {
  const [answer, action, pending] = useActionState(sendContact, CONTACT_IDLE);
  const [edited, setEdited] = useState(false);
  const [topic, setTopic] = useState("");
  const [length, setLength] = useState(0);
  const topicHint = CONTACT_TOPICS.find((t) => t.value === topic)?.hint;
  const state = edited ? CONTACT_IDLE : answer;
  const invalid = (field: ContactField) => state.status === "invalid" && state.field === field;

  useEffect(() => {
    if (answer.status === "invalid") document.getElementById(IDS[answer.field])?.focus();
  }, [answer]);

  if (answer.status === "ok" && !edited) {
    return (
      <div role="status" className="space-y-3 rounded-field border border-accent/40 bg-accent/10 p-5 text-sm text-text">
        <p className="font-semibold">{contactMessage(answer)}</p>
        <p>
          Your ticket number is <span className="numeric font-semibold">{answer.ticket}</span>. Note it down and quote it
          if you write to us again.
        </p>
        <p className="text-muted">
          We read every message by hand and reply to the email you gave. A complaint is acknowledged within 24 hours.
        </p>
      </div>
    );
  }

  const onSubmit = (event: FormEvent) => {
    if (pending) event.preventDefault();
    else setEdited(false);
  };

  return (
    <form
      action={action}
      onSubmit={onSubmit}
      onChange={() => setEdited(true)}
      noValidate
      className="relative space-y-5"
    >
      {/* Trap field: people never reach it, form-filling bots do. */}
      <div aria-hidden="true" className="absolute -left-[10000px] size-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor={IDS.name} className="block text-sm text-text">
            Your name
          </label>
          <input
            id={IDS.name}
            name="name"
            type="text"
            autoComplete="name"
            maxLength={CONTACT_LIMITS.name}
            required
            aria-invalid={invalid("name")}
            aria-describedby="contact-status"
            className={`${FIELD} h-12`}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor={IDS.email} className="block text-sm text-text">
            Your email
          </label>
          <input
            id={IDS.email}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            maxLength={254}
            required
            aria-invalid={invalid("email")}
            aria-describedby="contact-status"
            className={`${FIELD} h-12`}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor={IDS.topic} className="block text-sm text-text">
          What is it about?
        </label>
        <select
          id={IDS.topic}
          name="topic"
          required
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          aria-invalid={invalid("topic")}
          aria-describedby="contact-status"
          className={`${FIELD} h-12`}
        >
          <option value="" disabled>
            Choose one
          </option>
          {CONTACT_TOPICS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        {topicHint && <p className="text-sm text-muted">{topicHint}</p>}
      </div>

      {topic === "payment" && (
        <div className="space-y-2">
          <label htmlFor={IDS.payment_ref} className="block text-sm text-text">
            Payment ID or UPI reference (UTR), if you have it
          </label>
          <input
            id={IDS.payment_ref}
            name="payment_ref"
            type="text"
            autoComplete="off"
            maxLength={CONTACT_LIMITS.paymentRef}
            aria-invalid={invalid("payment_ref")}
            aria-describedby="contact-status"
            className={`${FIELD} h-12`}
          />
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor={IDS.message} className="block text-sm text-text">
          Your message
        </label>
        <textarea
          id={IDS.message}
          name="message"
          rows={6}
          required
          maxLength={CONTACT_LIMITS.messageMax}
          onChange={(e) => setLength(e.target.value.length)}
          aria-invalid={invalid("message")}
          aria-describedby="contact-status contact-count"
          className={`${FIELD} py-3`}
        />
        <p id="contact-count" className="numeric text-right text-xs text-muted">
          {length} / {CONTACT_LIMITS.messageMax}
        </p>
      </div>

      <p id="contact-status" aria-live="polite" aria-atomic="true" className="min-h-[1.25rem] text-sm text-red-400">
        {pending ? "" : contactMessage(state)}
      </p>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 items-center gap-3 rounded-full bg-accent px-6 text-sm font-semibold text-ink transition-opacity duration-200 disabled:opacity-40"
      >
        {pending ? (
          <>
            <TickLoader count={8} duration={0.7} className="text-ink" />
            Sending…
          </>
        ) : (
          "Send message"
        )}
      </button>
      <p className="text-sm text-muted">
        We use your name and email only to reply. You get a ticket number as soon as you send. See our{" "}
        <Link href="/privacy#collect">privacy policy</Link>
        .
      </p>
    </form>
  );
}
