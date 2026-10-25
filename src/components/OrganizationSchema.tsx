import { OPERATOR } from "@/lib/legal";
import { SITE_NAME } from "@/lib/site";
import { INDEXABLE, SITE_URL } from "@/lib/url";

// Organization data (JSON-LD) for search engines. Nothing is written until the
// real domain is set and the operator's legal name and email are filled in
// (src/lib/legal.ts), so no placeholder or guessed detail is ever published.
export function organizationData() {
  if (!INDEXABLE || !OPERATOR.legalName || !OPERATOR.supportEmail) return null;
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
        email: OPERATOR.supportEmail,
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
