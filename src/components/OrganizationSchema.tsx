import { OPERATOR } from "@/lib/legal";
import { SITE_NAME } from "@/lib/site";
import { INDEXABLE, SITE_URL } from "@/lib/url";

// Organization data (JSON-LD) for search engines. Nothing is written until the
// real domain is set and the operator's legal name is filled in
// (src/lib/legal.ts). The contact point is the contact form page; an email is
// added only if one is set, so no placeholder or guessed detail is published.
export function organizationData() {
  if (!INDEXABLE || !OPERATOR.legalName) return null;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    legalName: OPERATOR.legalName,
    url: SITE_URL,
    ...(OPERATOR.registeredAddress && { address: OPERATOR.registeredAddress }),
    ...(OPERATOR.gstin && { taxID: OPERATOR.gstin }),
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        url: `${SITE_URL}/contact`,
        ...(OPERATOR.supportEmail && { email: OPERATOR.supportEmail }),
        ...(OPERATOR.phone && { telephone: OPERATOR.phone }),
        areaServed: "IN",
        availableLanguage: ["English", "Hindi"],
      },
    ],
  };
}

export function OrganizationSchema() {
  const data = organizationData();
  if (!data) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
