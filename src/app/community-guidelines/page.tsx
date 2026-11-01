import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";
import { LEGAL_ROBOTS } from "@/lib/legal";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Community guidelines: ${SITE_NAME}`,
  description: `What creators and fans may and may not do on ${SITE_NAME}, how we screen messages and how to report a problem.`,
  alternates: { canonical: "/community-guidelines" },
  openGraph: {
    title: `Community guidelines: ${SITE_NAME}`,
    description: `What creators and fans may and may not do on ${SITE_NAME}, how we screen messages and how to report a problem.`,
    url: "/community-guidelines",
  },
  robots: LEGAL_ROBOTS,
};

const SECTIONS: LegalSection[] = [
  {
    id: "who",
    title: "Who these apply to",
    body: (
      <>
        <p>
          These guidelines apply to everyone who uses {SITE_NAME}: creators (their
          page, handle, profile picture, sounds and alerts) and fans (the name and
          message they add to a tip, and how they pay). They are part of our{" "}
          <Link href="/terms">terms of service</Link>.
        </p>
      </>
    ),
  },
  {
    id: "respect",
    title: "Be respectful",
    body: (
      <p>
        A tip’s name and message can appear on a public live stream and be read
        aloud to everyone watching. Write as you would in front of the creator’s
        audience. Honest feedback is welcome; insults, personal attacks and
        demeaning language are not.
      </p>
    ),
  },
  {
    id: "never",
    title: "Never allowed",
    body: (
      <>
        <p>In a name, message, handle, profile, sound or stream alert, never post:</p>
        <ul>
          <li>
            hate or discrimination against anyone because of their religion,
            caste, race, ethnicity, gender, sexual orientation, disability or any
            similar characteristic;
          </li>
          <li>threats, or content that encourages violence or self-harm;</li>
          <li>harassment, bullying or stalking of anyone, on or off the stream;</li>
          <li>sexual content, or offers of sexual services;</li>
          <li>
            anything that harms or sexualises children. We remove it and report it
            to the authorities;
          </li>
          <li>gambling, betting, lotteries or “get rich quick” offers;</li>
          <li>
            illegal drugs, weapons, piracy, hacking, or anything else that is
            illegal in India;
          </li>
          <li>links to scams, phishing or malware.</li>
        </ul>
      </>
    ),
  },
  {
    id: "money",
    title: "Keep money honest",
    body: (
      <>
        <p>
          A tip is a voluntary gift to a creator. Don’t use {SITE_NAME} to:
        </p>
        <ul>
          <li>pay for goods or services, or move money between people;</li>
          <li>raise funds for a cause, or tip yourself;</li>
          <li>pay with a card or UPI account that isn’t yours;</li>
          <li>launder money or move it for any other dishonest purpose;</li>
          <li>
            ask your bank to reverse a tip you meant to send. If something went
            wrong with a payment, see our{" "}
            <Link href="/refunds">refund and cancellation policy</Link> first.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "privacy",
    title: "Respect privacy and be yourself",
    body: (
      <ul>
        <li>
          Don’t share anyone’s personal details, such as a phone number, home
          address, email, workplace or real name they haven’t made public. This
          includes your own: a stream can be recorded by anyone watching.
        </li>
        <li>
          Don’t pretend to be someone else, such as another creator, a celebrity or
          {SITE_NAME} staff. A handle must not copy another creator, brand or
          person.
        </li>
      </ul>
    ),
  },
  {
    id: "spam",
    title: "No spam",
    body: (
      <p>
        Keep messages about the stream and the creator. No advertising,
        self-promotion or repeated messages. Links and email addresses are never
        read aloud.
      </p>
    ),
  },
  {
    id: "creators",
    title: "Extra rules for creators",
    body: (
      <ul>
        <li>
          Upload only sounds you made or have the right to play on your stream.
        </li>
        <li>
          Don’t use your page to promote anything listed under “Never allowed”, or
          to offer fans goods, services or rewards in return for a tip.
        </li>
        <li>Follow YouTube’s rules, as well as ours, when you show alerts.</li>
        <li>
          Use the tools you have: add banned words, approve messages before they
          play, and skip any alert you don’t want on screen.
        </li>
      </ul>
    ),
  },
  {
    id: "enforce",
    title: "How we keep it safe",
    body: (
      <>
        <ul>
          <li>
            <strong>Before you pay:</strong> every name and message is checked
            against the creator’s banned words. If one
            is blocked, the tip stops before payment, so you are never charged for
            it. You can change the words and try again.
          </li>
          <li>
            <strong>On stream:</strong> creators can approve each message first,
            skip an alert and add their own banned words. A message that breaks
            these guidelines is not shown, and a name that does shows as
            “Anonymous”.
          </li>
          <li>
            <strong>After a report:</strong> we look into it and may remove a
            message or sound, block someone from tipping, or warn, suspend or close
            a creator account. We may hold a payout while we check, as our{" "}
            <Link href="/terms#fees">terms</Link> describe.
          </li>
          <li>
            <strong>Serious harm:</strong> for fraud, threats, child safety or other
            illegal content, we keep the records the law requires and may report it
            to the police or other authorities.
          </li>
        </ul>
        <p>
          Our filters are automatic and can miss things, which is why reports
          matter.
        </p>
      </>
    ),
  },
  {
    id: "after-payment",
    title: "If a message is removed after you paid",
    body: (
      <p>
        The tip still reaches the creator and stays final, even if its message is
        held, rejected or removed for breaking these guidelines. Only payment
        errors are put right, as set out in our{" "}
        <Link href="/refunds">refund and cancellation policy</Link>.
      </p>
    ),
  },
  {
    id: "report",
    title: "Reporting a problem",
    body: (
      <p>
        If you see something that breaks these guidelines, tell us through our{" "}
        <Link href="/contact#grievance">grievance process</Link>. Include the
        creator’s handle, the payment reference if you have one, roughly when it
        happened and what was said. Our response times are on the{" "}
        <Link href="/contact">contact page</Link>.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these guidelines",
    body: (
      <p>
        We may update these guidelines as {SITE_NAME} grows or the law changes. The
        date at the top shows the latest version. If a change matters, we will tell
        creators by email before it applies.
      </p>
    ),
  },
];

export default function CommunityGuidelinesPage() {
  return (
    <LegalPage
      title="Community guidelines"
      path="/community-guidelines"
      intro={
        <p>
          How to use {SITE_NAME} so streams stay fun and safe. The short version:
          be kind, keep it legal, keep money honest and don’t share anyone’s
          private details.
        </p>
      }
      sections={SECTIONS}
    />
  );
}
