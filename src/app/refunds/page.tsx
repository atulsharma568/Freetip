import type { Metadata } from "next";
import Link from "next/link";
import { MailFill } from "@/components/legal/Fill";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Refunds and cancellations: ${SITE_NAME}`,
  description: `When a ${SITE_NAME} tip can be refunded, how to ask, and how long it takes.`,
};

const SECTIONS: LegalSection[] = [
  {
    id: "final",
    title: "Tips are final",
    body: (
      <p>
        A tip is a voluntary gift. Once the payment succeeds it goes to the
        creator straight away and may already have played live on their
        stream, which can’t be undone. So a tip can’t be cancelled or refunded
        because you changed your mind, picked the wrong amount, or didn’t like
        how the creator reacted. Before you pay, the page always shows the
        exact amount and the creator you are tipping.
      </p>
    ),
  },
  {
    id: "when",
    title: "When we refund",
    body: (
      <>
        <p>We refund the full amount when:</p>
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
          A refund always goes back to the card, UPI account or other method you
          paid with. We don’t refund in cash or to a different account.
        </p>
      </>
    ),
  },
  {
    id: "how",
    title: "How to ask for a refund",
    body: (
      <>
        <p>
          Write to <MailFill k="supportEmail" /> within 7 days of the payment
          (for an unauthorised payment, as soon as you notice it). Include:
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
      <table>
        <thead>
          <tr>
            <th>Step</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>We acknowledge your request and give you a ticket number</td>
            <td>Within 24 hours</td>
          </tr>
          <tr>
            <td>We check it with Razorpay and tell you our decision</td>
            <td>Within 5 working days</td>
          </tr>
          <tr>
            <td>If approved, we start the refund</td>
            <td>Within 2 working days of the decision</td>
          </tr>
          <tr>
            <td>The money reaches your account</td>
            <td>Usually 5 to 7 working days after that, depending on your bank</td>
          </tr>
        </tbody>
      </table>
    ),
  },
  {
    id: "failed",
    title: "Failed or pending payments",
    body: (
      <p>
        If money left your account but the payment failed or is stuck as
        pending, you usually don’t need to do anything: your bank or Razorpay
        reverses it automatically, normally within 5 to 7 working days (often
        sooner for UPI). If it hasn’t come back after 7 working days, write to
        us with the details above and we will chase it.
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
          Razorpay and the bank. The disputed amount may be held from the
          creator’s payouts until it is settled. We may block people who
          repeatedly raise chargebacks for genuine tips.
        </p>
      </>
    ),
  },
  {
    id: "creators",
    title: "For creators",
    body: (
      <ul>
        <li>
          There is no subscription, so there is nothing to cancel. You can close
          your account at any time, and we pay out any balance due after our
          usual checks.
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
      intro={
        <p>
          The short version: tips are final once paid, but if you were charged
          twice, charged the wrong amount, or your tip didn’t go through, we
          refund it in full to the way you paid. Tell us within 7 days and
          you’ll have an answer within 5 working days.
        </p>
      }
      sections={SECTIONS}
    />
  );
}
