import type { ReactNode } from "react";
import { PageShell } from "@/components/PageShell";
import { LEGAL_DRAFT, LEGAL_UPDATED } from "@/lib/legal";

export type LegalSection = { id: string; title: string; body: ReactNode };

// A policy page: title, date, the draft notice (until lib/legal.ts is filled
// in and reviewed), an "On this page" list and numbered sections.
export function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <PageShell>
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-6 pb-28 pt-12 md:pt-20 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16">
        <div className="lg:col-start-2">
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
        </div>
      </div>
    </PageShell>
  );
}
