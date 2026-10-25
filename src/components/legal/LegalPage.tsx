import type { ReactNode } from "react";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { LEGAL_DRAFT, LEGAL_UPDATED } from "@/lib/legal";
import { SITE_NAME } from "@/lib/site";
import { SITE_URL } from "@/lib/url";

export type LegalSection = { id: string; title: string; body: ReactNode };

// Pages that belong together, so each one links to its neighbours.
const RELATED: Record<string, { href: string; label: string }[]> = {
  "/terms": [
    { href: "/privacy", label: "Privacy policy" },
    { href: "/refunds", label: "Refunds and cancellations" },
    { href: "/pricing", label: "Pricing" },
  ],
  "/privacy": [
    { href: "/terms", label: "Terms of service" },
    { href: "/contact", label: "Contact and grievances" },
  ],
  "/refunds": [
    { href: "/terms", label: "Terms of service" },
    { href: "/delivery", label: "Delivery policy" },
    { href: "/contact", label: "Contact and grievances" },
  ],
  "/delivery": [
    { href: "/refunds", label: "Refunds and cancellations" },
    { href: "/terms", label: "Terms of service" },
  ],
  "/pricing": [
    { href: "/terms", label: "Terms of service" },
    { href: "/refunds", label: "Refunds and cancellations" },
    { href: "/about", label: "About" },
  ],
  "/about": [
    { href: "/pricing", label: "Pricing" },
    { href: "/contact", label: "Contact and grievances" },
  ],
  "/contact": [
    { href: "/privacy", label: "Privacy policy" },
    { href: "/terms", label: "Terms of service" },
    { href: "/refunds", label: "Refunds and cancellations" },
  ],
};

// A policy page: breadcrumb trail (with BreadcrumbList data), title, date, the draft notice (until lib/legal.ts is filled
// in and reviewed), an "On this page" list and numbered sections.
export function LegalPage({
  title,
  path,
  intro,
  sections,
}: {
  title: string;
  path: string;
  intro: ReactNode;
  sections: LegalSection[];
}) {
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
      { "@type": "ListItem", position: 2, name: title, item: `${SITE_URL}${path}` },
    ],
  };

  return (
    <PageShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbs).replace(/</g, "\\u003c"),
        }}
      />
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-6 pb-28 pt-12 md:pt-20 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16">
        <div className="lg:col-start-2">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link
                  href="/"
                  className="transition-colors duration-200 hover:text-text"
                >
                  {SITE_NAME}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="text-text">
                {title}
              </li>
            </ol>
          </nav>
          <h1 className="display text-[clamp(2.75rem,8vw,5rem)]">{title}</h1>
          <p className="mt-4 text-sm text-muted">Last updated {LEGAL_UPDATED}</p>
          {LEGAL_DRAFT && (
            <p className="mt-6 max-w-[68ch] rounded-field border border-accent/40 bg-accent/10 p-4 text-sm text-text">
              <strong>Draft before launch.</strong> Tipsite is not live yet. This
              page describes how it will work at launch. Details in{" "}
              <span className="font-medium text-accent">[brackets]</span> are
              still to be filled in, and the text is waiting for legal review.
            </p>
          )}
          <div className="legal mt-8 max-w-[68ch]">{intro}</div>
        </div>

        <nav
          aria-label="On this page"
          className="lg:sticky lg:top-8 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-start"
        >
          <p className="text-sm font-semibold">On this page</p>
          <ol className="mt-3 space-y-2 text-sm text-muted">
            {sections.map((section, i) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="transition-colors duration-200 hover:text-text"
                >
                  {i + 1}. {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="legal max-w-[68ch] lg:col-start-2">
          {sections.map((section, i) => (
            <section key={section.id} id={section.id} className="scroll-mt-8">
              <h2>
                {i + 1}. {section.title}
              </h2>
              {section.body}
            </section>
          ))}
          {RELATED[path] && (
            <nav aria-label="Related pages" className="mt-12 border-t border-line/60 pt-6">
              <p className="text-sm font-semibold">Related pages</p>
              <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
                {RELATED[path].map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="link-line transition-colors duration-200 hover:text-text">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </div>
    </PageShell>
  );
}
