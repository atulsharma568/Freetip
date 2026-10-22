"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { TickLoader } from "@/components/ui/TickLoader";
import { submitPayoutDetails, PAYOUT_IDLE } from "@/app/actions/creator";

type OnboardingState = "not_started" | "submitted" | "active" | "rejected";

interface Props {
  state: OnboardingState;
  initialLegalName: string;
  initialUpiVpa: string;
}

export function PayoutOnboarding({ state: initialState, initialLegalName, initialUpiVpa }: Props) {
  const [formState, action, pending] = useActionState(submitPayoutDetails, PAYOUT_IDLE);

  // After a successful submit, show the "under review" panel without a page reload.
  const [submitted, setSubmitted] = useState(
    initialState === "submitted" || initialState === "active",
  );

  const [legalName, setLegalName] = useState(initialLegalName);
  const [upiVpa, setUpiVpa] = useState(initialUpiVpa);

  // When the action returns ok, flip the local state.
  if (formState.status === "ok" && !submitted) {
    setSubmitted(true);
  }

  if (submitted || initialState === "submitted") {
    return (
      <div className="rounded-[var(--radius-surface)] border border-line/60 bg-surface p-6 space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted">
          Payout setup
        </h2>
        <div className="flex items-start gap-3">
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-yellow-400" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-base font-medium text-text">Under review</p>
            <p className="text-sm text-muted">
              We&apos;ll review your details and email you when your tip page goes live — usually within 1–2 business days.
            </p>
            {initialUpiVpa && (
              <p className="numeric text-xs text-muted pt-1">
                Payout UPI: {initialUpiVpa}
              </p>
            )}
          </div>
        </div>
        <p className="text-sm text-muted">
          Questions?{" "}
          <Link
            href="/contact"
            className="text-text underline decoration-line underline-offset-4 transition-colors hover:decoration-accent"
          >
            Contact us.
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-surface)] border border-line/60 bg-surface p-6 space-y-5">
      <div className="space-y-1">
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted">
          Set up payouts
        </h2>
        <p className="text-sm text-muted">
          Enter your details so tips reach you. We&apos;ll review and activate your page.
        </p>
      </div>

      {initialState === "rejected" && (
        <div className="rounded-[var(--radius-field)] border border-red-400/30 bg-red-400/5 px-4 py-3">
          <p className="text-sm text-red-400">
            Your previous submission was rejected. Please check your details and try again, or{" "}
            <Link href="/contact" className="underline">contact support</Link>.
          </p>
        </div>
      )}

      <form
        action={(formData) => {
          action(formData);
        }}
        className="space-y-5"
      >
        {/* Legal name */}
        <div className="space-y-2">
          <label
            htmlFor="payout-legal-name"
            className="text-sm font-medium uppercase tracking-widest text-muted"
          >
            Legal name
          </label>
          <input
            id="payout-legal-name"
            name="legal_name"
            type="text"
            required
            maxLength={100}
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            placeholder="Your full legal name"
            autoComplete="name"
            className="w-full h-12 rounded-[var(--radius-field)] border border-control bg-ground px-4 text-base text-text placeholder:text-muted transition-[border-color] focus:border-accent focus:outline-none"
          />
          <p className="text-xs text-muted">
            As it appears on your PAN or Aadhaar. Used for payout records only.
          </p>
        </div>

        {/* UPI VPA */}
        <div className="space-y-2">
          <label
            htmlFor="payout-upi-vpa"
            className="text-sm font-medium uppercase tracking-widest text-muted"
          >
            UPI ID
          </label>
          <input
            id="payout-upi-vpa"
            name="upi_vpa"
            type="text"
            required
            inputMode="email"
            value={upiVpa}
            onChange={(e) => setUpiVpa(e.target.value.toLowerCase())}
            placeholder="yourname@upi"
            autoComplete="off"
            className="w-full h-12 rounded-[var(--radius-field)] border border-control bg-ground px-4 font-mono text-base text-text placeholder:text-muted transition-[border-color] focus:border-accent focus:outline-none"
          />
          <p className="text-xs text-muted">
            Tips will be paid out to this UPI ID. You can find it in your UPI app.
          </p>
        </div>

        {formState.status === "error" && (
          <p role="alert" className="text-sm text-red-400">
            {formState.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || !legalName.trim() || !upiVpa.trim()}
          className="beam inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-accent px-8 text-base font-semibold text-ink transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? (
            <>
              <TickLoader count={10} duration={0.8} className="text-ink" />
              Submitting…
            </>
          ) : (
            "Submit for review →"
          )}
        </button>
      </form>
    </div>
  );
}
