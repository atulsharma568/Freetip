"use client";

import Link from "next/link";
import { useEffect, useId, useState, useTransition } from "react";
import { startPlanCheckout } from "@/app/actions/plan-checkout";
import { PLAN_NAMES, type PlanKey } from "@/lib/pricing";
import { Msg } from "../parts/Msg";
import { field, label, pillPrimary } from "../parts/styles";
import { TermSwitch } from "./TermSwitch";

export interface BuyOption {
  term: 1 | 12;
  amountMinor: number;
  early: boolean;
  // A running Creator pass already covers this Starter term to the end: buying it adds nothing.
  covered: boolean;
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

// The pay step for one plan and one term (both chosen above, on the plan cards). The amount shown is
// the amount sent: the server refuses the order if the price changed since this page was drawn.
export function BuyPass({
  plan,
  option,
  renewing,
  testMode,
  onTermChange,
  onBusyChange,
}: {
  plan: PlanKey;
  option: BuyOption;
  renewing: boolean;
  testMode: boolean;
  // The term switch inside the form (the one above the cards is the same state).
  onTermChange: (term: 1 | 12) => void;
  // True while a payment is being started, so the cards above can hold still.
  onBusyChange?: (busy: boolean) => void;
}) {
  const id = useId();
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  // A message belongs to the plan and term it was about: it is not shown once either changes.
  const [problem, setProblem] = useState<{ text: string; about: string } | null>(null);
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

  const busy = pending || leaving;
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  const about = `${plan}-${option.term}`;
  const error = problem?.about === about ? problem.text : "";
  const name = PLAN_NAMES[plan];
  const termText = option.term === 12 ? "12 months" : "1 month";

  function pay() {
    setProblem(null);
    start(async () => {
      const result = await startPlanCheckout({ plan, term: option.term, phone, expectAmountMinor: option.amountMinor, agreed });
      if (result.status === "error") {
        setProblem({ text: result.message, about });
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
      <div className="space-y-2">
        <h3 id="buy-step-title" tabIndex={-1} className="text-base font-medium text-text outline-none">
          {renewing ? `Add another term of ${name}` : `Buy ${name}`}
        </h3>
        <TermSwitch term={option.term} onChange={onTermChange} disabled={busy} label="Term to buy" />
        <p className="text-sm text-text">
          <span className="numeric font-medium">{rupees(option.amountMinor)}</span> for {termText}
          {option.early ? " · Early price" : ""}
        </p>
        <p className="text-xs text-muted">
          A one-off payment, not a subscription. It does not renew by itself, and when it ends nothing is charged
          unless you pay again.{renewing ? " A new term starts when your current one ends, so you lose no days." : ""}
        </p>
        {option.covered && (
          <p className="text-sm text-text">
            Your Creator plan already includes everything in Starter for this long, so this term would add nothing.
            Pick a longer term, or buy Starter after Creator ends.
          </p>
        )}
      </div>

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
        <button type="submit" disabled={busy || option.covered || !agreed || phone.trim().length < 10} aria-busy={busy} className={pillPrimary}>
          {busy ? "Opening PayU…" : `Pay ${rupees(option.amountMinor)} with PayU`}
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
