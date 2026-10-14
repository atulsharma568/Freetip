import type { Metadata } from "next";
import Link from "next/link";
import { Fill, MailFill } from "@/components/legal/Fill";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";
import { LEGAL_ROBOTS, OPERATOR } from "@/lib/legal";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Contact and grievances: ${SITE_NAME}`,
  description: `How to reach ${SITE_NAME} for help, payment problems, reports and complaints.`,
  robots: LEGAL_ROBOTS,
};

const SECTIONS: LegalSection[] = [
  {
    id: "support",
    title: "Help and questions",
    body: (
      <table>
        <tbody>
          <tr>
            <th scope="row">Email</th>
            <td>
              <MailFill k="supportEmail" />
            </td>
          </tr>
          <tr>
            <th scope="row">Phone</th>
            <td>
              {OPERATOR.phone ? (
                <a href={`tel:${OPERATOR.phone.replace(/\s/g, "")}`}>{OPERATOR.phone}</a>
              ) : (
                <Fill k="phone" />
              )}
            </td>
          </tr>
          <tr>
            <th scope="row">Hours</th>
            <td>
              <Fill k="hours" />
            </td>
          </tr>
          <tr>
            <th scope="row">Reply time</th>
            <td>Within 1 working day</td>
          </tr>
        </tbody>
      </table>
    ),
  },
  {
    id: "payments",
    title: "Payment problems",
    body: (
      <>
        <p>
          For a double charge, a failed payment or a tip that didn’t go
          through, email us with the payment ID or UPI reference (UTR), the
          amount, date and the creator’s handle. Our{" "}
          <Link href="/refunds">refund policy</Link> explains what happens next.
        </p>
        <p>
          <strong>
            We will never ask for your UPI PIN, card PIN, OTP or full card
            number.
          </strong>{" "}
          Anyone who does is not us.
        </p>
      </>
    ),
  },
  {
    id: "grievance",
    title: "Grievance Officer",
    body: (
      <>
        <p>
          For complaints about the service, a message or content you want
          removed, a payment you think was handled wrongly, or how we use your
          personal data, contact our Grievance Officer:
        </p>
        <table>
          <tbody>
            <tr>
              <th scope="row">Name</th>
              <td>
                <Fill k="grievanceOfficer" />
              </td>
            </tr>
            <tr>
              <th scope="row">Designation</th>
              <td>
                <Fill k="grievanceDesignation" />
              </td>
            </tr>
            <tr>
              <th scope="row">Email</th>
              <td>
                <MailFill k="grievanceEmail" />
              </td>
            </tr>
            <tr>
              <th scope="row">Address</th>
              <td>
                <Fill k="registeredAddress" />
              </td>
            </tr>
          </tbody>
        </table>
        <h3>Response times</h3>
        <ul>
          <li>We acknowledge every complaint within 24 hours and give you a ticket number.</li>
          <li>We resolve complaints within 15 days of receiving them.</li>
          <li>
            Content that shows someone in nudity or a sexual act, or
            impersonates them, is removed within 24 hours of a complaint by
            that person or someone acting for them.
          </li>
          <li>Other requests to remove content that breaks our rules are acted on within 72 hours.</li>
          <li>Privacy requests are completed within 30 days.</li>
        </ul>
        <h3>If you are not satisfied</h3>
        <ul>
          <li>
            About content decisions: appeal to the Grievance Appellate Committee
            at{" "}
            <a href="https://gac.gov.in" rel="noreferrer">
              gac.gov.in
            </a>{" "}
            within 30 days of our decision.
          </li>
          <li>
            About your personal data: complain to the Data Protection Board of
            India.
          </li>
          <li>
            About a purchase or refund: the National Consumer Helpline (1915 or{" "}
            <a href="https://consumerhelpline.gov.in" rel="noreferrer">
              consumerhelpline.gov.in
            </a>
            ).
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "company",
    title: "Company details",
    body: (
      <table>
        <tbody>
          <tr>
            <th scope="row">Legal name</th>
            <td>
              <Fill k="legalName" />
            </td>
          </tr>
          <tr>
            <th scope="row">Business type</th>
            <td>
              <Fill k="businessType" />
            </td>
          </tr>
          <tr>
            <th scope="row">Registered address</th>
            <td>
              <Fill k="registeredAddress" />
            </td>
          </tr>
          <tr>
            <th scope="row">GSTIN</th>
            <td>
              <Fill k="gstin" />
            </td>
          </tr>
          <tr>
            <th scope="row">Website</th>
            <td>
              <Link href="/">{SITE_NAME}</Link>
            </td>
          </tr>
        </tbody>
      </table>
    ),
  },
];

export default function ContactPage() {
  return (
    <LegalPage
      title="Contact and grievances"
      intro={
        <p>
          Email is the fastest way to reach us. For a payment problem, include
          the payment ID so we can find it quickly.
        </p>
      }
      sections={SECTIONS}
    />
  );
}
