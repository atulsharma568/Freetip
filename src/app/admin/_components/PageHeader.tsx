import Link from "next/link";
import type { ReactNode } from "react";
import { DefinitionNote } from "./Notices";

// The top of every owner page: an eyebrow, the title in the display style, and the
// one-sentence definition (the same shape the finance pages use).
export function PageHeader({
  eyebrow,
  title,
  note,
  back,
}: {
  eyebrow: string;
  title: string;
  note?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="space-y-1">
      {back && (
        <Link href={back.href} className="inline-flex min-h-9 items-center text-sm text-muted transition-colors hover:text-text">
          ← {back.label}
        </Link>
      )}
      <p className="flex items-center gap-2.5 text-sm font-semibold uppercase tracking-[0.2em] text-accent">
        <span aria-hidden="true" className="h-0.5 w-6 rounded-full bg-accent" />
        {eyebrow}
      </p>
      <h1 className="display text-[clamp(2rem,5vw,3.5rem)] leading-[0.95]">{title}</h1>
      {note && <DefinitionNote>{note}</DefinitionNote>}
    </div>
  );
}

// "Showing 1 to 50 of 132" with Previous and Next links. `hrefFor` builds the link
// for a page number (so each page keeps the current filters).
export function Pager({
  page,
  pageSize,
  total,
  shown,
  noun,
  hrefFor,
}: {
  page: number;
  pageSize: number;
  total: number;
  shown: number;
  noun: string;
  hrefFor: (page: number) => string;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = (page - 1) * pageSize + shown;
  const last = Math.max(1, Math.ceil(total / pageSize));
  const link = "inline-flex min-h-9 items-center rounded-full border border-control px-4 text-xs text-muted hover:border-text/40 hover:text-text";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
      <p>
        Showing {from} to {to} of {total} {noun}
        {total === 1 ? "" : "s"}
      </p>
      {last > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-2">
          {page > 1 && (
            <Link href={hrefFor(page - 1)} className={link}>
              Previous
            </Link>
          )}
          <span className="text-xs">
            Page {page} of {last}
          </span>
          {page < last && (
            <Link href={hrefFor(page + 1)} className={link}>
              Next
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
