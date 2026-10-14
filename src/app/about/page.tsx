import type { Metadata } from "next";
import Link from "next/link";
import { Fill } from "@/components/legal/Fill";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";
import { LEGAL_ROBOTS } from "@/lib/legal";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `About: ${SITE_NAME}`,
  description: `${SITE_NAME} is a tipping page for Indian YouTube live streamers, paid by UPI or card.`,
  robots: LEGAL_ROBOTS,
};

const SECTIONS: LegalSection[] = [
  {
    id: "what",
    title: "What we’re building",
    body: (
      <>
        <p>
          {SITE_NAME} gives every streamer one short link. Fans open it, pick an
          amount and pay with UPI or card, with no account and no email. The tip
          shows up on stream as an OBS alert, and the creator decides whether
          messages are read aloud and whether they approve each one first.
        </p>
        <p>
          We started with Indian YouTube live streamers because tipping should
          be as easy as the UPI app already on a fan’s phone.
        </p>
      </>
    ),
  },
  {
    id: "how",
    title: "How we work",
    body: (
      <ul>
        <li>One plain fee, the same on every page. No surprises in the payout.</li>
        <li>Fans stay private: an optional name, an anonymous option, no account.</li>
        <li>Creators stay in control of what plays on their stream.</li>
        <li>Samples are labelled as samples. We won’t show numbers we don’t have.</li>
      </ul>
    ),
  },
  {
    id: "status",
    title: "Where we are",
    body: (
      <p>
        {SITE_NAME} is not live yet. You can{" "}
        <Link href="/signup">join the waitlist</Link> to hear when it opens.
      </p>
    ),
  },
  {
    id: "who",
    title: "Who runs it",
    body: (
      <p>
        {SITE_NAME} is run by <Fill k="legalName" />, registered at{" "}
        <Fill k="registeredAddress" />. You can reach us on the{" "}
        <Link href="/contact">contact page</Link>.
      </p>
    ),
  },
];

export default function AboutPage() {
  return (
    <LegalPage
      title={`About ${SITE_NAME}`}
      intro={<p>Tips for Indian YouTube streamers, paid by UPI or card.</p>}
      sections={SECTIONS}
    />
  );
}
