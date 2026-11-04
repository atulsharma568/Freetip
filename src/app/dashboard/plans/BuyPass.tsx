"use client";

import Link from "next/link";
import { useEffect, useId, useState, useTransition } from "react";
import { startPlanCheckout } from "@/app/actions/plan-checkout";
import { OptionRadio } from "../parts/Controls";
import { Msg } from "../parts/Msg";
import { field, label, pillPrimary } from "../parts/styles";

export interface BuyOption {
  term: 1 | 12;
  amountMinor: number;
  early: boolean;
}

const rupees = (minor: number) => `₹${new Intl.NumberFormat("en-IN").format(Math.floor(minor / 100))}`;

// Posts a form to PayU's page. The browser leaves our site, pays there, and PayU sends it back to
// /api/payu/return. We never see card or UPI details.
function postToPayu(action: string, fields: Record<string, string>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export function BuyPass({ options, renewing, testMode }: { options: BuyOption[]; renewing: boolean; testMode: boolean }) {
  const id = useId();
  const [term, setTerm] = useState<1 | 12>(1);
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  // True from the moment PayU's form is posted until the browser leaves (or comes back with Back).
  const [leaving, setLeaving] = useState(false);

  // Coming back with the Back button restores this page as it was, with the button off.
  useEffect(() => {
    const back = (e: PageTransitionEvent) => {
      if (e.persisted) setLeaving(false);
    };
    window.addEventListener("pageshow", back);
    return () => window.removeEventListener("pageshow", back);
  }, []);

  const chosen = options.find((o) => o.term === term) ?? options[0];
  const busy = pending || leaving;

  function pay() {
    setError("");
    start(async () => {
      const result = await startPlanCheckout({ term: chosen.term, phone, expectAmountMinor: chosen.amountMinor, agreed });
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      setLeaving(true);
      postToPayu(result.action, result.fields);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) pay();
      }}
      className="space-y-5"
    >
      <fieldset className="space-y-2">
        <legend className={label}>{renewing ? "Add another term" : "Choose a term"}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((o) => (
            <OptionRadio
              key={o.term}
              name={`${id}-term`}
              value={String(o.term)}
              checked={term === o.term}
              onChange={() => setTerm(o.term)}
              hint={o.early ? "Early price" : o.term === 12 ? "Pay once for the year" : "Pay for one month"}
            >
              {rupees(o.amountMinor)} for {o.term === 12 ? "12 months" : "1 month"}
            </OptionRadio>
          ))}
        </div>
        <p className="text-xs text-muted">
          A one-off payment, not a subscription. It does not renew by itself, and when it ends nothing is charged
          unless you pay again.{renewing ? " A new term starts when your current one ends, so you lose no days." : ""}
        </p>
      </fieldset>

      <div className="space-y-2">
        <label htmlFor={`${id}-phone`} className={label}>
          Your mobile number
        </label>
        <input
          id={`${id}-phone`}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={16}
          placeholder="10-digit mobile number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={`${field} max-w-xs`}
          aria-describedby={`${id}-phone-note`}
        />
        <p id={`${id}-phone-note`} className="text-xs text-muted">
          PayU asks for it to complete the payment. We pass it to PayU and do not keep it.
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-sm text-muted">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 cursor-pointer accent-[var(--color-accent)]"
        />
        <span>
          I understand a pass is for a fixed term and is not refunded once its features are on (a payment error is
          still put right). I agree to the{" "}
          <Link href="/terms" target="_blank" className="text-text underline decoration-line hover:decoration-accent">
            Terms
          </Link>{" "}
          &amp;{" "}
          <Link href="/refunds" target="_blank" className="text-text underline decoration-line hover:decoration-accent">
            Refund Policy
          </Link>
          .
        </span>
      </label>

      <Msg kind="error" text={error} />

      <div className="space-y-2">
        <button type="submit" disabled={busy || !agreed || phone.trim().length < 10} aria-busy={busy} className={pillPrimary}>
          {busy ? "Opening PayU…" : `Pay ${rupees(chosen.amountMinor)} with PayU`}
        </button>
        <p className="text-xs text-muted">
          You pay on PayU&apos;s page by UPI, card or net banking. Your features switch on as soon as PayU confirms.
        </p>
        {testMode && (
          <p className="text-xs text-muted">Test mode: only you can see this button, and the payment is not real money.</p>
        )}
      </div>
    </form>
  );
}
