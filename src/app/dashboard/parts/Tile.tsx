import type { ReactNode } from "react";

type Kind = "surface" | "raised" | "accent";

const KIND: Record<Kind, string> = {
  surface: "border border-line/60 bg-surface",
  raised: "border border-line bg-raised",
  accent: "on-accent bg-accent text-ink",
};

// One dashboard tile: a 20px surface with a small uppercase label for its
// title (the main tile on a page uses its own Display title instead). Carries
// `data-tile`, which `Reveal` wipes in. `level` keeps the heading order
// straight: tiles under a group heading are h3, tiles on a sub page are h2.
export function Tile({
  id,
  title,
  level = 3,
  kind = "surface",
  className = "",
  children,
}: {
  id?: string;
  title?: string;
  level?: 2 | 3;
  kind?: Kind;
  className?: string;
  children: ReactNode;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section
      id={id}
      data-tile
      aria-labelledby={title ? headingId : undefined}
      className={`min-w-0 scroll-mt-20 space-y-4 rounded-surface p-6 md:p-8 ${KIND[kind]} ${className}`}
    >
      {title && (
        <Heading id={headingId} className="text-sm font-medium uppercase tracking-widest text-muted">
          {title}
        </Heading>
      )}
      {children}
    </section>
  );
}

// A group of tiles under a small heading (Today, Stream, Account).
export function Group({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-16 space-y-4 pt-10 first:pt-6">
      <h2
        id={`${id}-heading`}
        className="flex items-center gap-4 text-sm font-semibold uppercase tracking-widest text-text after:h-px after:flex-1 after:bg-line"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
