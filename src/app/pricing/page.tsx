import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";
import { FEES, LEGAL_ROBOTS } from "@/lib/legal";
import { LIVE_SALES_OPEN, TIER_PRICES } from "@/lib/pricing";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Pricing: ${SITE_NAME}`,
  description: `${SITE_NAME} takes ${FEES.platformPercent}% of each tip, plus a minimal processing fee, both out of the creator’s payout. No sign-up fee, and fans pay exactly the tip.`,
  alternates: { canonical: "/pricing" },
  openGraph: { title: `Pricing: ${SITE_NAME}`, description: `${SITE_NAME} takes ${FEES.platformPercent}% of each tip, plus a minimal processing fee, both out of the creator’s payout. No sign-up fee, and fans pay exactly the tip.`, url: "/pricing" },
  robots: LEGAL_ROBOTS,
};

// How many creators get the early price, read from the same place the Buy form reads it. It is
// counted per plan, so when the two plans differ the page says both numbers.
const { starter, creator } = TIER_PRICES;
const EARLY_SEATS =
  starter.early.seats === creator.early.seats
    ? `the first ${starter.early.seats} creators to buy that plan`
    : `the first ${starter.early.seats} creators to buy Starter and the first ${creator.early.seats} to buy Creator`;

const SECTIONS: LegalSection[] = [
  {
    id: "fee",
    title: "What creators pay",
    body: (
      <>
        <p>
          We take <strong>{FEES.platformPercent}% of every tip</strong>. There
          is no sign-up fee and no charge for the OBS alerts, text-to-speech,
          approval or QR code.
        </p>
        <p>
          We also charge a minimal processing fee on each tip. It is deducted
          from the creator’s payout as well. Fans pay exactly the amount they
          choose; nothing is added at checkout.
        </p>
      </>
    ),
  },
  {
    id: "paid-features",
    title: "Optional paid features",
    body: (
      <>
        <p>
          Some extras that change how a creator’s alerts, tip page and stream look
          and work are paid, for 1 or 12 months at a time. It is a one-off payment
          that does not renew by itself, and the price is shown in the creator’s
          dashboard before paying. Our fee on tips is the same with or without
          them. See the <Link href="/terms#fees">terms</Link> and the{" "}
          <Link href="/refunds">refund policy</Link>.
        </p>
        <p>
          <strong>Early price.</strong> Each plan, Starter and Creator, has a
          lower early price for {EARLY_SEATS}. Seats are counted for each plan
          separately, and a seat stays taken after a pass ends. The early price
          applies to the term bought, 1 month or 12 months, at the early price
          listed for that term. A creator who bought a plan at the early price
          keeps the early price when they buy another term of it before the pass
          ends, or within 31 days after it ends. The dashboard shows the price a
          creator will pay before they pay, and it never changes after they press
          Pay. If it changes while the form is open, for example because the last
          early seat has gone, nothing is charged and the creator is asked to
          reload and see the new price first.
          {LIVE_SALES_OPEN ? "" : " Plans are not open to buy yet. These rules apply from the day they open."}
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "If prices change",
    body: (
      <p>
        If our fee or the processing fee changes, we will tell creators at least
        30 days before it applies, and update this page.
      </p>
    ),
  },
  {
    id: "fans",
    title: "For fans",
    body: (
      <p>
        Tipping is free to use: no account, no email and no extra charge. All
        prices are in Indian rupees.
      </p>
    ),
  },
  {
    id: "taxes",
    title: "Taxes",
    body: (
      <p>
        GST is charged on our fee where it applies. Creators are responsible
        for tax on the tips they receive. Where the law requires us to deduct
        tax at source, it is shown in the payout statement. See our{" "}
        <Link href="/terms#fees">terms</Link> for details.
      </p>
    ),
  },
];

export default function PricingPage() {
  return (
    <LegalPage
      title="Pricing"
      path="/pricing"
      intro={
        <p>
          Simple pricing, shown before you sign up and the same on every page:{" "}
          {FEES.platformPercent}% of each tip, plus a minimal processing fee, both from
          the creator’s payout. Fans pay exactly the
          amount they choose.
        </p>
      }
      sections={SECTIONS}
    />
  );
}
