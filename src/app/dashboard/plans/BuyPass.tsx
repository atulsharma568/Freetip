"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { confirmPlanPayment, startPlanCheckout } from "@/app/actions/plan-checkout";
import { loadRazorpayScript } from "@/lib/razorpay-checkout";
import { PLAN_NAMES, type PlanKey } from "@/lib/pricing";
import { Msg, type MsgKind } from "../parts/Msg";
import { pillPrimary } from "../parts/styles";
import { TermSwitch } from "./TermSwitch";

export interface BuyOption {
  term: 1 | 12;
  amountMinor: number;
  // A running Creator pass already covers this Starter term to the end: buying it adds nothing.
  covered: boolean;
}

const rupees = (minor: number) => `₹${new Intl.NumberFormat("en-IN").format(Math.floor(minor / 100))}`;

// The pay step for one plan and one term (both chosen above, on the plan cards). The amount shown is
// the amount charged: the server refuses the order if the price changed since this page was drawn.
// The creator pays in Razorpay's popup on this page (the same one fans tip through); we never see card
// or UPI details. When the popup says it is paid, the server checks with Razorpay before anything is
// switched on, then the page reloads to show the result.
export function BuyPass({
  plan,
  option,
  renewing,
  testMode,
  liveOwnerTest = false,
  onTermChange,
  onBusyChange,
}: {
  plan: PlanKey;
  option: BuyOption;
  renewing: boolean;
  testMode: boolean;
  // Sales are closed to creators and this is the owner trying a real payment: it charges real money.
  liveOwnerTest?: boolean;
  // The term switch inside the form (the one above the cards is the same state).
  onTermChange: (term: 1 | 12) => void;
  // True while a payment is being started or is open, so the cards above can hold still.
  onBusyChange?: (busy: boolean) => void;
}) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  // A message belongs to the plan and term it was about: it is not shown once either changes.
  const [note, setNote] = useState<{ kind: MsgKind; text: string; about: string } | null>(null);
  const [pending, start] = useTransition();
  // True while Razorpay's popup is open, and while the payment is being confirmed afterwards.
  const [paying, setPaying] = useState(false);

  const busy = pending || paying;
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  const about = `${plan}-${option.term}`;
  const shown = note?.about === about ? note : null;
  const name = PLAN_NAMES[plan];
  const termText = option.term === 12 ? "12 months" : "1 month";

  function pay() {
    setNote(null);
    start(async () => {
      // A dropped connection or a server error must show a message here, not the dashboard's error page.
      try {
        const [result] = await Promise.all([
          startPlanCheckout({ plan, term: option.term, expectAmountMinor: option.amountMinor, agreed }),
          loadRazorpayScript().catch(() => undefined),
        ]);
        if (result.status === "error") {
          setNote({ kind: "error", text: result.message, about });
          return;
        }
        try {
          await loadRazorpayScript();
        } catch {
          setNote({ kind: "error", text: "Could not load the payment window. Check your connection and try again. Nothing was charged.", about });
          return;
        }
        setPaying(true);
        const rzp = new window.Razorpay({
          key: result.keyId,
          amount: result.amountMinor,
          currency: "INR",
          name: "Freetip",
          description: result.description,
          order_id: result.orderId,
          prefill: result.prefill,
          theme: { color: "#bfe84a" },
          handler: async (response: { razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string }) => {
            setNote({ kind: "info", text: "Payment received by Razorpay. Switching your features on…", about });
            let word = "pending";
            try {
              const confirmed = await confirmPlanPayment({
                orderId: response.razorpay_order_id ?? "",
                paymentId: response.razorpay_payment_id ?? "",
                signature: response.razorpay_signature ?? "",
              });
              word = confirmed.status;
            } catch {
              // The webhook and the page's own check still settle it; the page says it is waiting.
            }
            // The page reads the database for the truth; the word only decides whether to say something.
            router.replace(`/dashboard/plans?payment=${word}`);
            router.refresh();
            setPaying(false);
          },
          modal: {
            ondismiss: () => {
              setPaying(false);
              setNote({ kind: "info", text: "You closed the payment window, so nothing was charged. You can pay again whenever you like.", about });
            },
          },
        });
        rzp.open();
      } catch {
        setPaying(false);
        setNote({ kind: "error", text: "We could not reach the server. Nothing was charged. Check your connection and try again.", about });
      }
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

      <label className="flex cursor-pointer items-start gap-3 text-sm text-muted">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => {
            // Ticking the box is the sign the creator is about to pay: fetch the payment window now.
            if (e.target.checked) loadRazorpayScript().catch(() => {});
            setAgreed(e.target.checked);
          }}
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

      <Msg kind={shown?.kind} text={shown?.text} />

      <div className="space-y-2">
        <button type="submit" disabled={busy || option.covered || !agreed} aria-busy={busy} className={pillPrimary}>
          {busy ? "Opening payment…" : `Pay ${rupees(option.amountMinor)}`}
        </button>
        <p className="text-xs text-muted">
          You pay in Razorpay&apos;s secure window by UPI, card or net banking. Your features switch on as soon as the
          payment is confirmed.
        </p>
        {liveOwnerTest && (
          <p className="text-xs text-text">
            Live payment: this charges real money. Only you can see this button while sales are closed. To undo it,
            refund it in Razorpay yourself and use End plan now in the admin.
          </p>
        )}
        {testMode && (
          <p className="text-xs text-muted">Test mode: only you can see this button, and the payment is not real money.</p>
        )}
      </div>
    </form>
  );
}
