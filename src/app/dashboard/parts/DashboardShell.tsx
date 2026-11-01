import Link from "next/link";
import type { ReactNode } from "react";
import { PageShell } from "@/components/PageShell";
import { SITE_HOST } from "@/lib/site";

// The frame for every dashboard page: the wordmark, then the creator's own link
// with the live dot while tips are open (in place of "Back to home"), and a
// slim footer with the policy links instead of the marketing one.
export function DashboardShell({
  handle,
  live = false,
  children,
}: {
  handle?: string | null;
  live?: boolean;
  children: ReactNode;
}) {
  return (
    <PageShell
      headerEnd={
        handle ? (
          <Link
            href={`/${handle}`}
            className="-mr-2 inline-flex h-11 min-w-0 items-center gap-2.5 px-2 text-sm text-text transition-colors duration-200 hover:text-muted"
          >
            {live && <span className="live-dot shrink-0" aria-hidden="true" />}
            <span className="numeric max-w-[9rem] truncate sm:hidden">/{handle}</span>
            <span className="numeric hidden truncate sm:inline">
              {SITE_HOST}/{handle}
            </span>
            {live && <span className="sr-only">(tips are open)</span>}
          </Link>
        ) : null
      }
      footer={<SlimFooter />}
    >
      {children}
    </PageShell>
  );
}

const LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refunds", label: "Refunds" },
  { href: "/contact", label: "Contact and grievances" },
];

function SlimFooter() {
  return (
    <footer className="border-t border-line/60">
      <nav
        aria-label="Policies"
        className="mx-auto flex max-w-7xl flex-wrap gap-x-6 px-6 py-4 text-sm text-muted"
      >
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="inline-flex h-11 items-center transition-colors duration-200 hover:text-text"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
