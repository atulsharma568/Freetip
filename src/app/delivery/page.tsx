import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Delivery policy: ${SITE_NAME}`,
  description: `${SITE_NAME} is a digital service: how tips and payouts are delivered.`,
};

const SECTIONS: LegalSection[] = [
  {
    id: "digital",
    title: "Nothing is shipped",
    body: (
      <p>
        {SITE_NAME} is an online service. We don’t sell or ship physical
        goods, so there are no shipping charges, delivery addresses or courier
        times.
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
          confirmation on screen with a payment ID; keep it in case you need
          help.
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
    id: "payouts",
    title: "How payouts reach creators",
    body: (
      <ul>
        <li>
          Payouts are sent through Razorpay to the creator’s verified bank
          account in India, in Indian rupees, after our fee and the payment
          charge.
        </li>
        <li>
          We will publish the payout schedule before launch and show the
          status of every payout in the creator’s dashboard.
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
      title="Delivery policy"
      intro={
        <p>
          {SITE_NAME} is fully digital. Tips are delivered instantly when the
          payment succeeds, and payouts go to the creator’s bank account.
        </p>
      }
      sections={SECTIONS}
    />
  );
}
