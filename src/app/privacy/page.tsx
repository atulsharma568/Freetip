import type { Metadata } from "next";
import Link from "next/link";
import { Fill, MailFill } from "@/components/legal/Fill";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";
import { PROCESSORS } from "@/lib/legal";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Privacy policy: ${SITE_NAME}`,
  description: `What personal data ${SITE_NAME} collects, why, how long we keep it and your rights.`,
};

const SECTIONS: LegalSection[] = [
  {
    id: "who",
    title: "Who is responsible for your data",
    body: (
      <p>
        <Fill k="legalName" /> (“we”), registered at{" "}
        <Fill k="registeredAddress" />, decides how your personal data is used
        on {SITE_NAME}. Under India’s Digital Personal Data Protection Act, 2023
        we are the “data fiduciary”. For any privacy question or request, write
        to our Grievance Officer at <MailFill k="grievanceEmail" />.
      </p>
    ),
  },
  {
    id: "collect",
    title: "What we collect",
    body: (
      <>
        <p>We only collect what we need. It depends on how you use {SITE_NAME}.</p>
        <h3>If you join the waitlist (now)</h3>
        <ul>
          <li>your email address;</li>
          <li>
            if you give them, the handle you would like and your YouTube channel
            link;
          </li>
          <li>when you joined and which version of this notice you agreed to.</li>
        </ul>
        <h3>If you send a tip (after launch)</h3>
        <ul>
          <li>
            the amount, the optional name and message you add, the creator you
            tipped and when;
          </li>
          <li>
            payment details from Razorpay: whether the payment succeeded, the
            payment ID and the type of method (for example UPI or card). We
            never receive your full card number, UPI PIN, card PIN or OTP;
          </li>
          <li>
            no account and no email. Razorpay may ask for a phone number or
            email to complete a payment; that is covered by{" "}
            <a href="https://razorpay.com/privacy-policy/" rel="noreferrer">
              Razorpay’s privacy policy
            </a>
            .
          </li>
        </ul>
        <h3>If you are a creator (after launch)</h3>
        <ul>
          <li>your name, email, phone number, handle, channel link and profile image;</li>
          <li>
            bank account and identity details needed for KYC and payouts (some
            of these are collected and checked by Razorpay);
          </li>
          <li>your settings, such as alerts, text-to-speech, approval and banned words;</li>
          <li>tips received, fees, payouts and tax records.</li>
        </ul>
        <h3>From everyone</h3>
        <ul>
          <li>
            messages you send us, for example support requests or complaints;
          </li>
          <li>
            basic technical data such as your IP address, browser and device,
            used to keep the service secure and stop spam and fraud. For the
            waitlist we keep only a scrambled (hashed) form of your IP address,
            for at most 24 hours.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "why",
    title: "Why we use it",
    body: (
      <table>
        <thead>
          <tr>
            <th>Purpose</th>
            <th>Data used</th>
            <th>Basis</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Tell you when {SITE_NAME} launches and hold your handle request</td>
            <td>Waitlist details</td>
            <td>Your consent</td>
          </tr>
          <tr>
            <td>Process tips, show alerts and pay creators</td>
            <td>Tip, payment and creator details</td>
            <td>Providing the service you asked for</td>
          </tr>
          <tr>
            <td>Screen messages and handle reports</td>
            <td>Names, messages, reports</td>
            <td>Providing the service; legal duties as an intermediary</td>
          </tr>
          <tr>
            <td>Prevent fraud, abuse and spam; keep the service secure</td>
            <td>Technical and payment data</td>
            <td>Legitimate uses allowed by law; legal duties</td>
          </tr>
          <tr>
            <td>Keep tax, accounting and payment records</td>
            <td>Creator, tip and payout records</td>
            <td>Legal duties under Indian law</td>
          </tr>
          <tr>
            <td>Answer your messages and complaints</td>
            <td>What you send us</td>
            <td>Your request</td>
          </tr>
        </tbody>
      </table>
    ),
  },
  {
    id: "public",
    title: "What other people see",
    body: (
      <p>
        When you tip, the creator sees the amount, your name (unless you leave
        it blank) and your message. If the creator shows alerts, the same can
        appear on a public live stream and be read aloud to viewers. Anything
        on a stream can be recorded by others, so don’t put personal details
        in a message.
      </p>
    ),
  },
  {
    id: "sharing",
    title: "Who we share it with",
    body: (
      <>
        <p>
          We don’t sell your data, and we don’t share it with advertisers. We
          share it only with:
        </p>
        <ul>
          {PROCESSORS.map((p) => (
            <li key={p.name}>
              <strong>{p.name}</strong>, for {p.role}
              {p.status === "planned" ? " (from launch)" : ""};
            </li>
          ))}
          <li>the creator you tip, as described above;</li>
          <li>
            courts, police or authorities, when Indian law requires it, or to
            protect people from fraud or harm.
          </li>
        </ul>
        <p>
          These services may only use your data to do their job for us. Your
          data is stored in <Fill k="dataRegion" />. If any of it is processed
          outside India, it will be only in countries the Government of India
          allows.
        </p>
      </>
    ),
  },
  {
    id: "keep",
    title: "How long we keep it",
    body: (
      <ul>
        <li>
          <strong>Waitlist entries:</strong> until we have told you about the
          launch, then for no more than 12 months after the waitlist closes,
          or until you ask us to delete them, whichever comes first.
        </li>
        <li>
          <strong>Tip names and messages:</strong> 90 days, so creators and we
          can deal with reports and disputes. After that the name and message
          are deleted and only the payment record stays.
        </li>
        <li>
          <strong>Payment, payout and tax records:</strong> as long as Indian
          tax, accounting and anti-money-laundering laws require, currently up
          to 8 years.
        </li>
        <li>
          <strong>Creator accounts:</strong> while the account is open. When you
          close it we delete your profile within 30 days, except records we
          must keep by law.
        </li>
        <li>
          <strong>Security logs:</strong> at least one year, as the law requires,
          and no longer than needed.
        </li>
        <li>
          <strong>Hashed IP addresses from the waitlist:</strong> 24 hours.
        </li>
      </ul>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and tracking",
    body: (
      <p>
        We don’t use advertising or analytics cookies, tracking pixels or
        cross-site tracking. Right now the site sets no cookies at all. If we
        ever add a cookie that isn’t strictly needed to run the service, we
        will update this policy and ask for your consent first.
      </p>
    ),
  },
  {
    id: "security",
    title: "How we protect it",
    body: (
      <p>
        Data is encrypted in transit (HTTPS) and at rest with our database
        provider. Access is limited to people who need it to run {SITE_NAME}.
        Payments are handled by Razorpay, so card and UPI credentials never
        reach our servers. If a breach affects your data, we will tell you and
        the Data Protection Board of India as the law requires.
      </p>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    body: (
      <>
        <p>You can ask us to:</p>
        <ul>
          <li>give you a summary of the personal data we hold about you and how we use it;</li>
          <li>correct, complete or update it;</li>
          <li>delete it, unless the law requires us to keep it;</li>
          <li>
            stop using it where you gave consent. Withdrawing consent is as
            easy as giving it: use the unsubscribe link in any email or write
            to us. It doesn’t affect what we did before;
          </li>
          <li>
            let someone you nominate exercise these rights for you if you die
            or become unable to;
          </li>
          <li>resolve a complaint about how we handle your data.</li>
        </ul>
        <p>
          Write to <MailFill k="grievanceEmail" /> from the email you used with
          us (or tell us the payment ID for a tip). We may ask you to confirm
          who you are. We acknowledge every request within 24 hours and
          complete it within 30 days. If you are not satisfied with our answer,
          you can complain to the Data Protection Board of India.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <p>
        {SITE_NAME} is only for people aged 18 and over. We don’t knowingly
        collect data from children. If you think a child has given us personal
        data, contact us and we will delete it.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        If we change this policy, we will update the date at the top. If the
        change matters, we will tell you by email or on the site before it
        applies, and ask for fresh consent where the law requires.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact and complaints",
    body: (
      <p>
        Grievance Officer: <Fill k="grievanceOfficer" />,{" "}
        <Fill k="grievanceDesignation" />, <MailFill k="grievanceEmail" />,{" "}
        <Fill k="registeredAddress" />. Full details and response times are on
        our <Link href="/contact#grievance">contact page</Link>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      intro={
        <p>
          The short version: fans tip without an account or email, we collect
          only what we need to run {SITE_NAME}, we never sell your data or use
          ad trackers, and you can ask us to see, fix or delete what we hold.
        </p>
      }
      sections={SECTIONS}
    />
  );
}
