import type { Metadata } from "next";
import Link from "next/link";
import { Fill, MailFill } from "@/components/legal/Fill";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";
import { PROCESSORS } from "@/lib/legal";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Privacy policy: ${SITE_NAME}`,
  description: `What personal data ${SITE_NAME} collects, why, how long we keep it and your rights.`,
  alternates: { canonical: "/privacy" },
  openGraph: { title: `Privacy policy: ${SITE_NAME}`, description: `What personal data ${SITE_NAME} collects, why, how long we keep it and your rights.`, url: "/privacy" },
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
        <h3>If you join the waitlist</h3>
        <ul>
          <li>your email address;</li>
          <li>
            if you give them, the handle you would like and your YouTube channel
            link;
          </li>
          <li>
            when you joined, which form you used (home page or sign-up page)
            and which version of this notice you agreed to.
          </li>
        </ul>
        <h3>If you send a tip</h3>
        <ul>
          <li>
            the amount, the optional name and message you add, the creator you
            tipped and when;
          </li>
          <li>
            payment details from our payment partner: whether the payment succeeded, the
            payment ID and the type of method (for example UPI or card). We
            never receive your full card number, UPI PIN, card PIN or OTP;
          </li>
          <li>
            no account and no email. Our payment partner may ask for a phone
            number or email to complete a payment; that is covered by their own
            privacy policy.
          </li>
        </ul>
        <h3>If you tip a creator who uses fan levels or a fan list</h3>
        <p>
          These are optional tools a creator can switch on for their own page.
          Only if the creator has switched one on, and only when you type a name
          (a tip left anonymous is never counted), we also keep a small fan
          profile for that creator:
        </p>
        <ul>
          <li>
            the name you typed, a scrambled (hashed) code made from the creator
            and that name so the same name is matched on later tips, the number
            of tips, the total amount, the points (1 for every ₹1) and the level
            they add up to, and the dates of your first and latest tip;
          </li>
          <li>
            if the creator adds one, a private note of their own about you. We
            do not read it and it is never shown to you or on the stream.
          </li>
        </ul>
        <p>
          A profile is only a name. We have no way to know who you really are,
          so the same name typed by two people is counted as one fan, anyone can
          type someone else&apos;s name, and a changed spelling starts a new
          profile.
        </p>
        <h3>If you are a creator</h3>
        <ul>
          <li>
            your name, email and profile picture from Google, your handle and your
            YouTube channel (see the next section);
          </li>
          <li>the legal name and UPI ID you give us for payouts;</li>
          <li>
            any identity details needed for KYC (some of these are collected and
            checked by our payment partner);
          </li>
          <li>your settings, such as alerts, text-to-speech, approval and banned words;</li>
          <li>tips received, fees, payouts and tax records;</li>
          <li>
            if you buy a paid features pass: what is listed in the next
            heading.
          </li>
        </ul>
        <h3>If you buy a paid features pass</h3>
        <p>
          The payment is taken by our payment provider, not by us. When you press
          Pay, we send the provider:
        </p>
        <ul>
          <li>your name, from your Google account;</li>
          <li>your email address, from your Google account;</li>
          <li>the amount and our order reference.</li>
        </ul>
        <p>
          You then pay in the provider&apos;s own secure window, which may ask
          you for your mobile number, and it handles your card, UPI or net
          banking details itself. We never receive your full card number, UPI
          PIN or net banking password. What the provider does with the data it
          receives is covered by its own privacy policy, which is shown on its
          payment page.
        </p>
        <p>For each order, whether or not it was paid, we keep:</p>
        <ul>
          <li>
            your creator account, the plan (Starter or Creator) and the term (1
            or 12 months) you bought;
          </li>
          <li>the amount, our order reference and the provider&apos;s payment ID;</li>
          <li>
            the dates: when the order was made, when it was paid, and when the
            pass starts and ends, and a short note of why if it did not go
            through or if we ended the plan early (for example after a refund);
          </li>
          <li>
            whether the early price applied, and which features the pass
            switched on;
          </li>
          <li>
            the time you pressed Pay with the box ticked, agreeing to our Terms and Refund Policy,
            and which version of those texts you agreed to. We keep this as
            proof of what was agreed.
          </li>
        </ul>
        <p>
          We keep the record of an order that was paid for up to 8 years from
          the day it was paid, because tax and accounting records have to be
          kept, and delete it after that. An order that was never paid is
          deleted after 12 months. Our audit history, which can only be added to
          and is kept for as long as we run the service, also holds a short
          note when a payment is confirmed, a plan ends, or we change something
          on your account. It names your account and the order, and holds no
          card details and no mobile number. See “How long we keep it” below.
        </p>
        <h3>From everyone</h3>
        <ul>
          <li>
            messages you send us, for example support requests or complaints.
            From the contact form we keep your name, your email, what the
            message is about, the payment reference if you add one, and the
            message itself, only to read it and reply. We delete a message 12
            months after it was sent once we have dealt with it;
          </li>
          <li>
            basic technical data such as your IP address, browser and device,
            used to keep the service secure and stop spam and fraud. To limit
            how often one network can join the waitlist or send a contact
            message, we keep only a scrambled (hashed) form of your IP
            address, never the address itself. It is needed for one hour and deleted automatically within
            48 hours at the latest.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "google",
    title: "Google sign-in and YouTube data",
    body: (
      <>
        <p>
          When you sign in with Google, we ask Google for four things: your email
          address (and whether Google has verified it), your name, your profile
          picture, and read-only access to your YouTube channel
          (the <code>youtube.readonly</code> permission).
        </p>
        <p>
          We use the YouTube access only to find the channel you own. From it we
          store the channel ID, the channel name and the channel link, next to
          your name, email and picture. We do not read your videos, comments,
          subscribers, watch history or analytics, and signing in never lets us
          post to YouTube.
        </p>
        <p>
          <strong>Optional: stream timestamps.</strong> If you choose to turn on
          stream timestamps, a separate step on your dashboard asks Google for
          one more permission (<code>youtube.force-ssl</code>). We use it for
          one thing only: to post a single comment on your own live stream,
          after it ends, listing the moments viewers saved with !ts. To do that
          we also ask YouTube which of your broadcasts is live right now. We do not
          read your comments or videos, and we do not post anything else. You
          can take the permission back at any time with{" "}
          <strong>Disconnect YouTube</strong> on your dashboard (which also
          cancels it with Google), from your Google account&apos;s security
          page, or by closing your account.
        </p>
        <p>
          We use this information to link your channel to your Freetip page,
          so fans can tip you and your alerts can show on your stream, and, if
          you buy a paid features pass, to take that payment through our payment provider and
          email you before the pass ends. It is not
          used for advertising, not sold, and not shared, except with the services
          that run the site (listed under “Who we share it with”) or where the
          law requires it. Nobody at
          Freetip reads this data except with your permission (for example when
          you ask us for support), to keep the service secure, or where the law
          requires it.
        </p>
        <p>
          Freetip’s use and transfer to any other app of information received
          from Google APIs will adhere to the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
        <h3>How we store and protect it</h3>
        <p>
          We keep your email, name, picture, Google account ID and YouTube channel
          details in our database (Neon, in Singapore). They are encrypted in
          transit (HTTPS) and at rest, and only people who need them to run
          Freetip can reach them. Google’s access token is used once, at the
          moment you sign in, to look up your channel, and is not saved. If you
          turn on stream timestamps, we also keep the refresh token Google gives
          us for that one permission, encrypted, so we can post the comment
          after your stream ends; without that step we cannot call YouTube on
          your behalf later. After sign-in, your browser holds one encrypted session cookie that contains
          only your Google account ID.
        </p>
        <h3>How long we keep it, and how to delete it</h3>
        <p>
          We keep this data while your creator account is open. To have it
          deleted, use <strong>Close your account</strong> at the bottom of your
          dashboard, or ask us through the <Link href="/contact">contact form</Link>{" "}
          from the email you signed up with. Closing erases your profile,
          including the Google data above, straight away. We keep only the records
          we must keep by law (tip, payout, paid features order and tax records,
          which do not include your YouTube data), and your handle stays reserved so nobody else can
          take it. If money is still owed to you or a payout is in progress, we
          settle that first. You can also take away our access at
          any time from your Google Account at myaccount.google.com/permissions;
          without that access we can no longer read your channel.
        </p>
        <h3>What we do not do with it</h3>
        <p>
          We do not sell Google user data, use it for advertising, or give it to
          data brokers. We do not use it to build databases, to decide credit or
          lending, or to develop, improve or train any artificial intelligence or
          machine-learning model, and we do not pass it to anyone for those
          purposes.
        </p>
        <table>
          <thead>
            <tr>
              <th>Google data</th>
              <th>Why we use it</th>
              <th>Stored?</th>
              <th>Shared with</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Email (verified), name, picture</td>
              <td>Identify you; your name and picture also appear on your public tip page; if you buy a paid features pass, take that payment and email you before it ends</td>
              <td>Yes, while your account is open</td>
              <td>The services that run the site, including our payment provider if you buy a pass</td>
            </tr>
            <tr>
              <td>YouTube channel ID, name and link (read-only)</td>
              <td>Link your channel to your tip page</td>
              <td>Yes, while your account is open</td>
              <td>Only the services that run the site; the channel name and link appear on your public tip page</td>
            </tr>
            <tr>
              <td>Google access token</td>
              <td>Look up your channel once at sign-in</td>
              <td>No</td>
              <td>Nobody</td>
            </tr>
          </tbody>
        </table>
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
            <td>Sign you in and link your YouTube channel to your creator page</td>
            <td>Google account details, and your channel ID, name and link</td>
            <td>Providing the service you asked for</td>
          </tr>
          <tr>
            <td>Keep you posted about {SITE_NAME} and hold your handle request</td>
            <td>Waitlist details</td>
            <td>Your consent</td>
          </tr>
          <tr>
            <td>Process tips, show alerts and pay creators</td>
            <td>Tip, payment and creator details</td>
            <td>Providing the service you asked for</td>
          </tr>
          <tr>
            <td>Show a fan&apos;s level on the alert, and give the creator a list of supporters (only for creators who switch these on)</td>
            <td>Fan profile: name, tip counts and totals, points and level, the creator&apos;s own note</td>
            <td>Providing the service the creator and you asked for</td>
          </tr>
          <tr>
            <td>Take payment for a paid features pass (through our payment provider), switch the features on, show your receipt, email you before a pass ends, and keep proof of what you agreed to</td>
            <td>Pass orders and payment ID, your sign-in email and name (sent to the payment provider), the time you agreed to the terms and which version</td>
            <td>Providing the service you asked for; legal duties as to accounts</td>
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
    id: "fan-profiles",
    title: "Fan profiles: what a creator sees and a stream shows",
    body: (
      <>
        <p>
          If a creator has switched on fan levels, your level (for example
          “Lv 3”) can appear on their alert next to your name, on a live stream.
          If they have switched on the fan list, the creator can see, in their
          private dashboard, each fan&apos;s name, number of tips, total amount,
          level and dates, and can search, sort, add a
          note, download the list as a file, or delete a fan. The creator
          is responsible for what they do with a list they download.
        </p>
        <p>
          To ask us to delete your profile, write to our
          Grievance Officer with the creator&apos;s handle and the name you used.
          Because a name is all we have, we may ask you for a payment ID from one
          of your tips to be sure the profile is yours.
        </p>
      </>
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
              {p.status === "planned" ? " (when we switch it on)" : ""};
            </li>
          ))}
          <li>the creator you tip, as described above;</li>
          <li>
            courts, police or authorities, when Indian law requires it, or to
            protect people from fraud or harm.
          </li>
        </ul>
        <p>
          These services may only use your data to do their job for us. If{" "}
          {SITE_NAME} is ever sold or merged with another company, your data may
          pass to the new owner, who must keep to this policy. Your data is
          stored in <Fill k="dataRegion" />. If any of it is processed
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
          are deleted and only the payment record stays. The only exception is
          a fan profile, below.
        </li>
        <li>
          <strong>Fan profiles:</strong> only if a creator uses fan levels, the
          fan list. A profile (name, totals, points,
          level and the creator&apos;s note)
          is kept for 12 months after your latest tip, then deleted
          automatically. A new tip on a creator&apos;s page starts the 12 months
          again. The creator can delete a fan&apos;s profile at any time, and
          closing a creator account deletes all of that creator&apos;s profiles
          straight away. If the creator switches these tools off, no new
          profiles are made and the existing ones are still deleted after 12
          months.
        </li>
        <li>
          <strong>Stream timestamps:</strong> if a creator uses them, the
          chat name of the viewer who typed !ts and what they typed after it
          are kept 90 days, then deleted. If the creator switches on public
          highlights pages or an editor link, those show the times and what was
          typed, never a viewer&apos;s name. Moments added automatically for
          big tips and completed goals carry only the amount or the goal&apos;s
          title, not a fan&apos;s name. The creator&apos;s YouTube connection
          and Discord address are kept encrypted until the creator disconnects
          them or closes their account.
        </li>
        <li>
          <strong>Streamlabs alerts:</strong> only if a creator connects their
          own Streamlabs account. Each paid tip is then sent to Streamlabs as
          an alert for that creator: the fan&apos;s name (or &quot;Anonymous&quot;),
          the amount and, when it would show on the creator&apos;s stream, the
          message. A message the creator rejected, or that has a word they
          banned, is not sent. Streamlabs keeps what it receives under its own
          policy. We keep the creator&apos;s Streamlabs sign-in encrypted until
          they disconnect or close their account, then delete it straight
          away. The queue of alerts waiting to be sent holds no names or
          messages.
        </li>
        <li>
          <strong>Payment, payout and tax records:</strong> as long as Indian
          tax, accounting and anti-money-laundering laws require, currently up
          to 8 years.
        </li>
        <li>
          <strong>Paid features orders:</strong> only if a creator buys a
          pass. The order record (the account, plan and term, the amount, our
          order reference, the provider&apos;s payment ID, the dates, and the time the
          creator agreed to the Terms and Refund Policy with the version they
          agreed to) of a paid order is kept for up to 8 years from the day it
          was paid, because tax and accounting records have to be kept, then
          deleted; an order that was never paid is deleted after 12 months. The creator&apos;s mobile
          number is not part of it: we do not store it. The payment provider keeps what it
          receives under its own policy.
        </li>
        <li>
          <strong>Creator accounts:</strong> while the account is open. When you
          close it your profile is erased straight away, along with any
          contact-form messages sent from your sign-in email, except records we
          must keep by law and your reserved handle (and your old handle, if you changed it once).
        </li>
        <li>
          <strong>Security logs:</strong> at least one year, as the law requires,
          and no longer than needed.
        </li>
        <li>
          <strong>Hashed IP addresses from the waitlist:</strong> used for one
          hour and deleted automatically within 48 hours at the latest.
        </li>
      </ul>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and tracking",
    body: (
      <p>
        We set one essential cookie, which keeps you signed in after you sign in
        with Google. It holds no tracking data and is needed to run the account.
        On a tip page, if you tick “Remember my name on this device”, the name
        you type is saved in your own browser (not on our servers) so the box is
        filled next time; clear your browser&apos;s site data, or untick the box,
        to remove it.{" "}
        {process.env.NEXT_PUBLIC_GA_ID
          ? "If you press Accept on the banner, we also load Google Analytics, which sets cookies and sends Google anonymised visit data (pages viewed, rough location, device type) so we can count visits. If you press No thanks, nothing from Google loads, and you can clear this choice in your browser’s site data. It never runs on the creator or owner areas or the stream alert. We don’t use advertising cookies, tracking pixels or cross-site tracking."
          : "We don’t use advertising or analytics cookies, tracking pixels or cross-site tracking. If we ever add a cookie that isn’t strictly needed to run the service, we will update this policy and ask for your consent first."}
      </p>
    ),
  },
  {
    id: "no-ads",
    title: "No advertising. No data selling.",
    body: (
      <p>
        We do not run ads, use advertising cookies or tracking pixels, sell your
        personal data to third parties, or share it for any purpose other than
        operating {SITE_NAME}. We collect what we need to run the service and
        nothing more.
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
        Payments are handled by our payment partner under the PCI-DSS card security
        standard, so card and UPI credentials never reach our servers. If a breach affects your data, we will tell you and
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
        We don’t knowingly collect data from children. If you think a child has
        given us personal data, contact us and we will delete it.
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
      path="/privacy"
      intro={
        <p>
          The short version: fans tip without an account or email, we collect
          only what we need to run {SITE_NAME}, we never sell your data or use
          ad trackers, and you can ask us to see, fix or delete what we hold.
        </p>
      }
      sections={SECTIONS}
      hideDraftNotice
    />
  );
}
