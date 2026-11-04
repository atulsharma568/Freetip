import { LIVE_SALES_OPEN } from "@/lib/pricing";
import type { Metadata } from "next";
import Link from "next/link";
import { Fill, MailFill } from "@/components/legal/Fill";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";
import { FEES } from "@/lib/legal";
import { SITE_HOST, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Terms of service: ${SITE_NAME}`,
  description: `The rules for creators and fans using ${SITE_NAME}.`,
  alternates: { canonical: "/terms" },
  openGraph: { title: `Terms of service: ${SITE_NAME}`, description: `The rules for creators and fans using ${SITE_NAME}.`, url: "/terms" },
};

const SECTIONS: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are and what these terms cover",
    body: (
      <>
        <p>
          {SITE_NAME} ({SITE_HOST}) is run by <Fill k="legalName" />, a{" "}
          <Fill k="businessType" /> registered in India, with its registered
          office at <Fill k="registeredAddress" />. In these terms, “we”, “us”
          and “our” mean <Fill k="legalName" />.
        </p>
        <p>
          These terms are an agreement between you and us. They apply whenever
          you use {SITE_NAME}: when you join the waitlist, create a creator
          page, or send a tip. Our{" "}
          <Link href="/community-guidelines">community guidelines</Link>,{" "}
          <Link href="/privacy">privacy policy</Link>,{" "}
          <Link href="/refunds">refund and cancellation policy</Link> and{" "}
          <Link href="/delivery">shipping and delivery policy</Link> are part of
          these terms.
        </p>
      </>
    ),
  },
  {
    id: "words",
    title: "Words we use",
    body: (
      <ul>
        <li>
          <strong>Creator:</strong> a streamer who has a {SITE_NAME} page and
          receives tips.
        </li>
        <li>
          <strong>Fan:</strong> anyone who sends a tip. Fans don’t need an
          account.
        </li>
        <li>
          <strong>Tip:</strong> a voluntary payment a fan sends to a creator
          through a {SITE_NAME} page, with an optional name and message.
        </li>
        <li>
          <strong>Alert:</strong> the on-stream notice of a tip, shown through
          the creator’s OBS browser source, which may also read the message
          aloud.
        </li>
        <li>
          <strong>Payout:</strong> money we send to a creator’s UPI ID or bank
          account from the tips they received, after fees.
        </li>
      </ul>
    ),
  },
  {
    id: "eligibility",
    title: "Who can use Freetip",
    body: (
      <>
        <p>
          You must be able to enter a binding contract under Indian law to use
          {SITE_NAME}, as a creator or as a fan.
        </p>
        <p>
          To receive tips, a creator must also have a UPI ID or bank account in
          India in their own name and complete the identity and account checks
          (KYC) that we or our payment partner ask for. You can’t use {SITE_NAME} if we have
          closed your account before for breaking these terms, or if the law
          does not allow you to.
        </p>
      </>
    ),
  },
  {
    id: "creator-accounts",
    title: "Creator accounts",
    body: (
      <ul>
        <li>Give us accurate details and keep them up to date.</li>
        <li>
          Keep your login safe. You are responsible for what happens in your
          account. Tell us straight away if you think someone else has used it.
        </li>
        <li>
          One account per person. Your handle must not copy another creator,
          brand or person, or be offensive. We may reclaim a handle that breaks
          this rule or is left unused.
        </li>
        <li>
          We may refuse an application, or ask for more information, if we
          can’t verify who you are.
        </li>
      </ul>
    ),
  },
  {
    id: "tips",
    title: "How tips work",
    body: (
      <>
        <ul>
          <li>
            A fan opens a creator’s page, chooses an amount, may add a name and a
            message, and pays with UPI, card or another method our payment
            partner offers. The fan pays exactly the amount they choose.
          </li>
          <li>
            A tip is a voluntary gift to the creator. It does not buy goods, a
            service, access or any promise from the creator, and the creator
            does not have to read, show or respond to it.
          </li>
          <li>
            The creator decides whether tips appear as alerts on their stream,
            whether messages are read aloud and whether each one waits for
            their approval. A tip still reaches the creator even if no alert is
            shown.
          </li>
          <li>
            Payments are handled by our payment partner. We never see
            your full card number, and we will never ask for your UPI PIN, card
            PIN or OTP. Anyone who does is not us.
          </li>
          <li>
            Once a payment succeeds, the tip is complete and cannot be
            cancelled. The exceptions are in our{" "}
            <Link href="/refunds">refund and cancellation policy</Link>.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "fees",
    title: "Fees, payouts and taxes",
    body: (
      <>
        <ul>
          <li>
            <strong>Our fee:</strong> {FEES.platformPercent}% of every tip, plus a{" "}
            {FEES.gatewayPercent}% payment processing fee, both taken from the creator’s payout.
            There is no sign-up fee, and nothing to pay to receive tips or to
            use the OBS alert, sounds, goals or the recap.
          </li>
          <li>
            <strong>Paid features:</strong> some extra features that change how
            a creator’s alerts, tip page and stream look and work are paid. A
            creator buys a plan, Starter or Creator, for 1 month or 12 months
            with a one-off payment in Indian rupees through our payment
            provider. Each plan is paid for and ends separately. A custom
            tip page is built for a creator on request, at a price we agree
            before any work starts. The price is
            shown in the creator’s dashboard before paying and is the full
            amount; nothing is added at checkout. {LIVE_SALES_OPEN ? "The first creators to buy a plan get" : "Each plan will have"} a lower early price{LIVE_SALES_OPEN ? "" : " for its first creators"}, and a creator who has it keeps it when
            they renew in time; the rules are on the{" "}
            <Link href="/pricing#paid-features">pricing page</Link>. The
            features switch on when the payment is confirmed. A pass does not renew by itself: when it
            ends the paid features switch off and nothing more is charged unless
            the creator buys again, and a new term bought before the end starts
            when the current one ends. We try to email a reminder about 5 days
            before a pass ends. A pass covers the features of its plan available
            when it is bought; a feature we add later may need a new term. A price
            change never changes a pass already paid for. The fee on tips is the
            same with or without a pass. A pass is not refundable once its
            features are on, except for the payment errors in our{" "}
            <Link href="/refunds">refund and cancellation policy</Link>. That
            includes when a creator closes their account or we close or suspend
            it under these terms.
          </li>
          <li>
            <strong>Processing fee:</strong> We also charge a minimal fee for
            processing each tip. It is deducted from the creator’s payout, on
            top of our fee. See <Link href="/pricing">pricing</Link>.
          </li>
          <li>
            <strong>Fans</strong> pay no fees to us.
          </li>
          <li>
            <strong>Payouts</strong> go to the bank account or UPI ID the creator
            registers and we verify, in Indian rupees, through our payment
            partner. We show each payout in the creator’s dashboard and do not
            promise a particular day.
          </li>
          <li>
            <strong>Holds:</strong> we may hold or delay a payout while we look
            into suspected fraud, a chargeback, a KYC problem, a breach of these
            terms, or a request from a court or authority. We will tell you why
            unless the law stops us.
          </li>
          <li>
            <strong>Mistakes:</strong> if we pay out money that was not due (for
            example, a tip later refunded or charged back), we may deduct it from
            later payouts or ask you to repay it.
          </li>
          <li>
            <strong>Taxes:</strong> creators are responsible for their own income
            tax and GST on tips. Where Indian law requires us to deduct tax at
            source, we will, and we will show it in your payout statement. GST
            on our fee will be charged where it applies (GSTIN:{" "}
            <Fill k="gstin" />
            ).
          </li>
        </ul>
        <p>
          We will give creators at least 30 days’ notice by email before we
          raise our fee or our processing fee.
        </p>
      </>
    ),
  },
  {
    id: "messages",
    title: "Names and messages",
    body: (
      <>
        <p>
          Fans can add a name and a short message to a tip. Messages may be
          shown on a public live stream and read aloud, so don’t include phone
          numbers, addresses or other personal details, yours or anyone
          else’s. A fan may leave the name blank to tip anonymously.
        </p>
        <p>
          Messages are checked against a length limit and
          the creator’s own banned words before they can play, and the creator can
          choose to approve each one first. Screening is automatic and can miss
          things. The person who wrote a message is responsible for it.
        </p>
      </>
    ),
  },
  {
    id: "not-allowed",
    title: "What is not allowed",
    body: (
      <>
        <p>You must not use {SITE_NAME}, or any name or message, to:</p>
        <ul>
          <li>
            harass, threaten, bully or abuse anyone, or promote hatred or
            violence against a person or group;
          </li>
          <li>
            share sexual content, or any content that harms or sexualises
            children;
          </li>
          <li>
            share someone’s personal information, impersonate anyone, or mislead
            people about who you are;
          </li>
          <li>
            post content that is illegal in India, infringes someone’s
            copyright, trademark or other rights, or promotes gambling, drugs or
            weapons;
          </li>
          <li>send spam, advertising or links to scams or malware;</li>
          <li>
            pay with a card or account that isn’t yours or that you aren’t
            allowed to use, launder money, or move money for any purpose other
            than a genuine tip;
          </li>
          <li>
            tip yourself or arrange tips to move money between people, raise
            funds for a cause, or sell goods or services;
          </li>
          <li>raise chargebacks for tips you made yourself and intended to make;</li>
          <li>
            get around our fees, screening or limits, or interfere with, scrape,
            overload or reverse-engineer the service;
          </li>
          <li>
            break YouTube’s or any other platform’s rules while using {SITE_NAME};
            or
          </li>
          <li>
            use {SITE_NAME} for anything our payment partner or the banks do not
            allow.
          </li>
        </ul>
        <p>
          Our <Link href="/community-guidelines">community guidelines</Link>{" "}
          explain these rules with examples. We may remove a message, block a fan
          from tipping, or act under section 10 if we find or are told about
          content or behaviour like this. To report something, see{" "}
          <Link href="/contact#grievance">grievances</Link>.
        </p>
      </>
    ),
  },
  {
    id: "refunds",
    title: "Refunds and chargebacks",
    body: (
      <p>
        Tips are final once paid and are not refundable. The only exceptions
        are the payment errors set out in our{" "}
        <Link href="/refunds">refund and cancellation policy</Link>, such as a
        duplicate charge or a payment that went through but failed to reach
        the creator. Please contact us before raising a chargeback with your
        bank; we can usually fix problems faster. If a fan’s bank reverses a
        tip, the amount is taken back from the creator’s balance or later
        payouts.
      </p>
    ),
  },
  {
    id: "suspension",
    title: "Suspending or closing accounts",
    body: (
      <>
        <p>
          You can close your creator account at any time from your dashboard or
          by writing to us. We pay out any balance that is due, after the checks
          in section 6.
        </p>
        <p>
          We may suspend or close an account, block payments, or hold a payout
          if you break these terms, if we reasonably suspect fraud or illegal
          activity, if our payment partner or the law requires it, or if your
          account puts other users or us at risk. Where we can, we will tell you
          first and give you a chance to explain. If you think we got it wrong,
          contact us and we will review it.
        </p>
      </>
    ),
  },
  {
    id: "content",
    title: "Your content and ours",
    body: (
      <>
        <p>
          Creators keep the rights to their name, channel, images and stream
          content. You give us permission to use your handle, display name,
          channel link and profile image to run your page, show it to fans and
          send alerts. Fans give the creator and us permission to show and read
          aloud the name and message they add to a tip.
        </p>
        <p>
          Creators can upload short sounds that fans pick to play with their
          alert. You may upload only sounds you made or have the right to use
          on your stream, and you are responsible for them, including any
          copyright claim they cause. We can listen to, hide or remove any
          sound, and may do so if we are told it breaks someone’s rights or
          section 10.
        </p>
        <p>
          Creators can also upload pictures, GIFs and short videos that play
          in their alert. They go live as soon as they are uploaded, without
          our review. You may upload only files you made or have the right to
          use, and nothing that breaks section 10 or our community guidelines.
          You are responsible for them, including any copyright claim they
          cause. We may look at, hide or remove any file at any time, and may
          close an account that keeps uploading files that break these rules.
        </p>
        <p>
          {SITE_NAME}’s name, logo, design and software belong to us. You may
          not copy them or use them in a way that suggests we endorse you.
        </p>
      </>
    ),
  },
  {
    id: "other-services",
    title: "Other services we rely on",
    body: (
      <p>
        {SITE_NAME} works with services we don’t control, including our payment
        partner, banks and UPI apps, YouTube and OBS. Their own terms apply when
        you use them. We are not responsible for their outages, decisions or
        delays — for example, a bank that declines a payment, a UPI app that is
        down, or a tip that fails because of an NPCI or network disruption. If a
        payment fails for any of these reasons, the fan&apos;s money is returned
        by the bank or payment system; the creator does not receive the tip and
        we do not receive our fee. Links to other websites are there for your
        convenience; we don’t control those sites and are not responsible for
        them.
      </p>
    ),
  },
  {
    id: "disclaimers",
    title: "What we can’t promise",
    body: (
      <p>
        We work to keep {SITE_NAME} running smoothly and securely, but we
        provide it “as is”. We can’t promise it will always be available,
        error-free or that screening will catch every bad message. We don’t
        endorse creators or their content, and we are not responsible for what
        creators do on their streams, or for whether a creator acts on a tip.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limits on our liability",
    body: (
      <>
        <p>
          As far as the law allows, we are not liable for indirect losses, such
          as lost profits, lost viewers or damage to reputation. Our total
          liability to you for any claim is limited to the fees you paid us in
          the 12 months before the claim (for a creator) or the amount of the tip
          concerned (for a fan).
        </p>
        <p>
          Nothing in these terms limits liability that cannot be limited by law,
          including for fraud or gross negligence, or your rights as a consumer
          under the Consumer Protection Act, 2019.
        </p>
      </>
    ),
  },
  {
    id: "indemnity",
    title: "If you break these terms",
    body: (
      <p>
        If you break these terms or the law while using {SITE_NAME}, and that
        leads to a claim, fine or loss for us, you agree to cover our reasonable
        costs of it.
      </p>
    ),
  },
  {
    id: "mistakes",
    title: "Mistakes on our site",
    body: (
      <p>
        If a page shows a wrong price, fee or description, we will correct it as
        soon as we find it. A tip is always charged at the amount you confirm on
        the payment screen; if a payment itself went wrong, our{" "}
        <Link href="/refunds">refund and cancellation policy</Link> applies.
      </p>
    ),
  },
  {
    id: "feedback",
    title: "Ideas and feedback",
    body: (
      <p>
        If you send us ideas or suggestions for {SITE_NAME}, we may use them
        without owing you anything. We won’t publish your name or personal
        details with them.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to Freetip and to these terms",
    body: (
      <p>
        We may change or stop features as the product grows. If we change these
        terms in a way that matters, we will tell creators by email and show a
        notice on the site at least 15 days before the change applies (30 days
        for a fee increase). The date at the top shows the latest version. If
        you keep using {SITE_NAME} after a change applies, the new terms apply
        to you; if you don’t agree, you can close your account.
      </p>
    ),
  },
  {
    id: "general",
    title: "General",
    body: (
      <ul>
        <li>
          If a court finds part of these terms invalid, the rest still applies.
        </li>
        <li>
          If we don’t enforce a right straight away, we can still enforce it
          later.
        </li>
        <li>
          These terms, with the policies they link to, are the whole agreement
          between you and us about {SITE_NAME}.
        </li>
        <li>
          Anything owed before an account is closed, such as fees, a chargeback or
          a cost under section 15, is still owed after it closes.
        </li>
      </ul>
    ),
  },
  {
    id: "law",
    title: "Law and disputes",
    body: (
      <p>
        These terms are governed by the laws of India. If something goes wrong,
        please contact us first: most problems can be solved quickly through our{" "}
        <Link href="/contact#grievance">grievance process</Link>. If a dispute
        is not resolved, the courts at <Fill k="courtCity" />, India have
        jurisdiction, without affecting your right to approach a consumer
        commission or any other authority the law allows.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions about these terms: <MailFill k="supportEmail" />, or see our{" "}
        <Link href="/contact">contact page</Link> for every way to reach us,
        including our Grievance Officer.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      path="/terms"
      intro={
        <p>
          The rules for using {SITE_NAME}, in plain language. The short version:
          tips are voluntary gifts, fans pay exactly what they choose, creators
          pay our {FEES.platformPercent}% fee and the processing fee from their
          payout, and nobody may use {SITE_NAME} to abuse people or move money
          dishonestly.
        </p>
      }
      sections={SECTIONS}
      hideDraftNotice
    />
  );
}
