import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";
import { FEES, LEGAL_ROBOTS } from "@/lib/legal";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Pricing: ${SITE_NAME}`,
  description: `${SITE_NAME} takes ${FEES.platformPercent}% of each tip, plus a minimal processing fee, both out of the creator’s payout. No sign-up or monthly fees, and fans pay exactly the tip.`,
  alternates: { canonical: "/pricing" },
  openGraph: { title: `Pricing: ${SITE_NAME}`, description: `${SITE_NAME} takes ${FEES.platformPercent}% of each tip, plus a minimal processing fee, both out of the creator’s payout. No sign-up or monthly fees, and fans pay exactly the tip.`, url: "/pricing" },
  robots: LEGAL_ROBOTS,
};

const SECTIONS: LegalSection[] = [
  {
    id: "fee",
    title: "What creators pay",
    body: (
      <>
        <p>
          We take <strong>{FEES.platformPercent}% of every tip</strong>. There
          is no sign-up fee, no monthly plan and no charge for the OBS alerts,
          text-to-speech, approval or QR code.
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
