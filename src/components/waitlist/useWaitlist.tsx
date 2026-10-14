"use client";

import { useActionState, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { joinWaitlist } from "@/app/actions/waitlist";
import {
  WAITLIST_IDLE,
  waitlistMessage,
  type WaitlistEntry,
  type WaitlistField,
} from "@/lib/waitlist";

// Shared state for the two waitlist forms (home page and /signup). The
// server's answer shows until the person edits a field again, and a field it
// rejects gets focus back. `ids` maps each field the form has to its input's
// id, and must be a module-level constant.
export function useWaitlist(ids: Partial<Record<WaitlistField, string>>) {
  const [answer, action, pending] = useActionState(joinWaitlist, WAITLIST_IDLE);
  const [edited, setEdited] = useState(false);
  const state = edited ? WAITLIST_IDLE : answer;

  useEffect(() => {
    const id = answer.status === "invalid" && ids[answer.field];
    if (id) document.getElementById(id)?.focus();
  }, [answer, ids]);

  return {
    action,
    pending,
    // A second press while saving is ignored.
    onSubmit: (event: FormEvent) => {
      if (pending) event.preventDefault();
      else setEdited(false);
    },
    onEdit: () => setEdited(true),
    message: pending ? "Adding you to the waitlist…" : waitlistMessage(state),
    invalid: (field: WaitlistField) => state.status === "invalid" && state.field === field,
  };
}

// Which form was used, and a trap field that people never see or reach but
// form-filling bots do (the server quietly drops anything that fills it).
export function WaitlistHiddenFields({ source }: { source: WaitlistEntry["source"] }) {
  return (
    <>
      <input type="hidden" name="source" value={source} />
      <div aria-hidden="true" className="absolute -left-[10000px] size-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
    </>
  );
}

const CONSENT_TONES = {
  lime: { text: "text-ink/80", link: "text-ink decoration-ink/50 hover:decoration-ink" },
  dark: { text: "text-muted", link: "text-text decoration-line hover:decoration-accent" },
};

// The notice people agree to by pressing the button.
export function ConsentNote({ tone }: { tone: keyof typeof CONSENT_TONES }) {
  const t = CONSENT_TONES[tone];
  return (
    <p className={`max-w-[52ch] text-sm ${t.text}`}>
      By joining, you agree that we can email you about the launch. See how we
      use your details in our{" "}
      <Link href="/privacy#collect" className={`underline underline-offset-2 ${t.link}`}>
        privacy policy
      </Link>
      .
    </p>
  );
}
