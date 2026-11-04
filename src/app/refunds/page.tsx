import type { Metadata } from "next";
import Link from "next/link";
import { MailFill } from "@/components/legal/Fill";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";
import { LEGAL_ROBOTS } from "@/lib/legal";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Refunds and cancellations: ${SITE_NAME}`,
  description: `${SITE_NAME} tips are final. The few payment errors we do put right, how to report one, and how long it takes.`,
  alternates: { canonical: "/refunds" },
  openGraph: { title: `Refunds and cancellations: ${SITE_NAME}`, description: `${SITE_NAME} tips are final. The few payment errors we do put right, how to report one, and how long it takes.`, url: "/refunds" },
  robots: LEGAL_ROBOTS,
};

const SECTIONS: LegalSection[] = [
  {
    id: "final",
    title: "Tips are final",
    body: (
      <>
        <p>
          <strong>We don’t offer refunds on tips.</strong> A tip is a
          voluntary gift. Once the payment succeeds it goes to the creator
          straight away and may already have played live on their stream, which
          can’t be undone. Before you pay, the page always shows the exact
          amount and the creator you are tipping.
        </p>
        <p>A successful tip can’t be cancelled or refunded because:</p>
        <ul>
          <li>you changed your mind, or picked the wrong amount or creator;</li>
          <li>
            your message was held, rejected, removed or not read aloud, or the
            creator chose not to approve it (a name or message our filter blocks
            is stopped before you pay, so you are never charged for it; see our{" "}
            <Link href="/community-guidelines">community guidelines</Link>);
          </li>
          <li>the creator was offline, or the stream ended before the alert played;</li>
          <li>you didn’t like how the creator reacted, or the creator is banned or has left.</li>
        </ul>
      </>
    ),
  },
  {
    id: "when",
    title: "Payment errors we put right",
    body: (
      <>
        <p>
          The only exception is a payment error: money taken that should not
          have been, or a tip that never worked. This isn’t a refund of a tip
          you chose to send. We return the full amount when we confirm that:
        </p>
        <ul>
          <li>you were charged more than once for the same tip;</li>
          <li>
            money left your account but the payment shows as failed, or the tip
            never reached the creator;
          </li>
          <li>you were charged a different amount from the one shown to you;</li>
          <li>
            a technical error on our side stopped the tip from working as
            described; or
          </li>
          <li>
            someone used your card or UPI account without your permission (also
            tell your bank straight away).
          </li>
        </ul>
        <p>
          The money always goes back to the card, UPI account or other method you
          paid with. We don’t pay it in cash or to a different account. Whether
          and how fast it arrives also depends on your bank, your UPI app and our
          payment partner.
        </p>
      </>
    ),
  },
  {
    id: "how",
    title: "How to report a payment error",
    body: (
      <>
        <p>
          Write to <MailFill k="supportEmail" /> as soon as you notice the
          problem (for an unauthorised payment, also tell your bank straight
          away). Include:
        </p>
        <ul>
          <li>the payment ID from your confirmation screen, or the UPI reference (UTR);</li>
          <li>the amount, date and time;</li>
          <li>the creator’s handle;</li>
          <li>how you paid (UPI or card) and what went wrong.</li>
        </ul>
        <p>
          Never send your UPI PIN, card PIN, OTP or full card number. We will
          never ask for them.
        </p>
      </>
    ),
  },
  {
    id: "timeline",
    title: "What happens next",
    body: (
      <p>
        We acknowledge your request, check it with our payment partner and tell
        you our decision. If we confirm an error, the money goes back the way
        you paid. How soon it shows in your account depends on your bank, your
        UPI app and our payment partner.
      </p>
    ),
  },
  {
    id: "failed",
    title: "Failed or pending payments",
    body: (
      <p>
        If money left your account but the payment failed or is stuck as
        pending, you usually don’t need to do anything: your bank or our payment
        partner reverses it automatically, normally within a few working days (often
        sooner for UPI). If it hasn’t come back after that, write to us with
        the details above and we will chase it.
      </p>
    ),
  },
  {
    id: "chargebacks",
    title: "Chargebacks",
    body: (
      <>
        <p>
          Please contact us before you ask your bank to reverse a payment. We
          can usually sort things out faster, and a chargeback for a tip you
          meant to send takes the money back from the creator.
        </p>
        <p>
          When a bank opens a chargeback, we share the payment records with
          our payment partner and the bank. The disputed amount may be held from the
          creator’s payouts until it is settled.{" "}
          If you repeatedly raise chargebacks for tips you meant to send, we may
          block further tips from you.
        </p>
      </>
    ),
  },
  {
    id: "from-creator",
    title: "Money back from a creator",
    body: (
      <p>
        We can’t return a tip on a creator’s behalf. If a creator chooses to give
        money back to a fan, they do it themselves, outside {SITE_NAME}, and it
        does not change the tip on {SITE_NAME}.
      </p>
    ),
  },
  {
    id: "creators",
    title: "For creators",
    body: (
      <ul>
        <li>
          Nothing renews by itself, so there is nothing to cancel. A paid
          features pass is a one-off payment for a fixed term (see the next
          section). You can close your account at any time, and we pay out any
          balance due after our usual checks.
        </li>
        <li>
          If a tip is refunded or charged back, the tip amount comes back out of
          your balance or later payouts. If the refund was caused by an error
          on our side, we cover it and your payout is not reduced.
        </li>
        <li>
          Our fee on a completed tip is not refundable, except when the tip
          itself is refunded under this policy.
        </li>
      </ul>
    ),
  },
  {
    id: "passes",
    title: "Paid feature passes",
    body: (
      <>
        <p>
          <strong>A pass is not refunded once its features are on.</strong> It is
          a one-off payment for 1 or 12 months and does not renew by itself.
          We don’t refund a pass because you changed your mind, didn’t use the
          features, closed your account, or the term ended. We also don’t refund
          one when we close or suspend an account under our terms.
        </p>
        <p>
          The exception is a payment error. We put it right when we confirm that:
        </p>
        <ul>
          <li>you were charged more than once for the same term;</li>
          <li>
            money left your account but the features did not switch on after the
            payment was confirmed;
          </li>
          <li>you were charged a different amount from the price shown to you; or</li>
          <li>a technical error on our side stopped the pass from working as described.</li>
        </ul>
        <p>
          Where the features simply did not switch on, we switch them on for the
          full term. Otherwise we return the full amount to the way you paid. To
          report one, write to <MailFill k="supportEmail" /> with the payment
          ID on your receipt (or from your bank or UPI app), the amount and the
          date.
        </p>
      </>
    ),
  },
  {
    id: "waitlist",
    title: "Waitlist",
    body: (
      <p>
        Joining the waitlist is free and involves no payment. You can leave it
        at any time with the unsubscribe link in our emails, or by writing to
        us.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Still not sorted?",
    body: (
      <p>
        If you are unhappy with how we handled a refund, contact our{" "}
        <Link href="/contact#grievance">Grievance Officer</Link>. You can also
        call the National Consumer Helpline on 1915 or use{" "}
        <a href="https://consumerhelpline.gov.in" rel="noreferrer">
          consumerhelpline.gov.in
        </a>
        .
      </p>
    ),
  },
];

export default function RefundsPage() {
  return (
    <LegalPage
      title="Refunds and cancellations"
      path="/refunds"
      intro={
        <p>
          The short version: tips are final once paid, and so is a paid
          features pass once its features are on. But if you were charged
          twice, charged the wrong amount, or your payment didn’t work, we
          put it right and return the money the way you paid. Tell us as soon
          as you notice.
        </p>
      }
      sections={SECTIONS}
    />
  );
}
