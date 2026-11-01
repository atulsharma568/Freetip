import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";
import { LEGAL_ROBOTS } from "@/lib/legal";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Shipping and delivery policy: ${SITE_NAME}`,
  description: `${SITE_NAME} is a digital service with nothing to ship: how tips and payouts are delivered.`,
  alternates: { canonical: "/delivery" },
  openGraph: { title: `Shipping and delivery policy: ${SITE_NAME}`, description: `${SITE_NAME} is a digital service with nothing to ship: how tips and payouts are delivered.`, url: "/delivery" },
  robots: LEGAL_ROBOTS,
};

const SECTIONS: LegalSection[] = [
  {
    id: "digital",
    title: "Nothing is shipped",
    body: (
      <p>
        {SITE_NAME} is an online service. We don’t sell or ship physical
        goods, so there are no shipping charges, delivery addresses, courier
        times or tracking numbers.
      </p>
    ),
  },
  {
    id: "tips",
    title: "How a tip is delivered",
    body: (
      <ul>
        <li>
          A tip is delivered the moment the payment succeeds. You see a
          confirmation on screen with a reference; keep it in case you need
          help. We don’t ask for your email, so we don’t send a receipt; our
          payment partner may send its own if you gave it your email or phone.
        </li>
        <li>
          The tip is added to the creator’s balance straight away, whether or
          not they are live.
        </li>
        <li>
          Whether it also shows as an alert on stream depends on the creator’s
          settings: alerts may be off, the message may wait for the creator’s
          approval, or it may be filtered out by screening. The tip is still
          delivered to the creator in every case.
        </li>
        <li>
          If you paid but saw no confirmation, see{" "}
          <Link href="/refunds#failed">failed or pending payments</Link>.
        </li>
      </ul>
    ),
  },
  {
    id: "records",
    title: "The records we keep",
    body: (
      <p>
        For each tip we keep the payment reference, when the payment succeeded
        and when its alert was sent to the creator’s stream. We use them to
        answer questions about a tip and, if a payment is disputed, to show our
        payment partner and the bank what happened. How long we keep them is in
        our <Link href="/privacy#keep">privacy policy</Link>.
      </p>
    ),
  },
  {
    id: "payouts",
    title: "How payouts reach creators",
    body: (
      <ul>
        <li>
          Payouts are sent through our payment partner to the bank account or
          UPI ID the creator registers and we verify, in Indian rupees, after
          our fee and the processing fee.
        </li>
        <li>
          Payouts are made on a regular schedule, not the moment a tip lands.
          We show the status of every payout in the creator’s dashboard and
          don’t promise a particular day. We will tell creators before the
          schedule changes.
        </li>
        <li>
          Payouts can be delayed by bank holidays, incomplete KYC, or a hold
          described in our <Link href="/terms#fees">terms</Link>.
        </li>
      </ul>
    ),
  },
  {
    id: "problems",
    title: "If something isn’t delivered",
    body: (
      <p>
        If a tip or payout doesn’t arrive as described here, write to us from
        the <Link href="/contact">contact page</Link>. Refunds follow our{" "}
        <Link href="/refunds">refund and cancellation policy</Link>.
      </p>
    ),
  },
];

export default function DeliveryPage() {
  return (
    <LegalPage
      title="Shipping and delivery policy"
      path="/delivery"
      intro={
        <p>
          {SITE_NAME} is fully digital. Tips are delivered instantly when the
          payment succeeds, and payouts go to the creator’s registered bank
          account or UPI ID.
        </p>
      }
      sections={SECTIONS}
    />
  );
}
