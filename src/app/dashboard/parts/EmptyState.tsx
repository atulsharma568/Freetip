import type { ReactNode } from "react";

// An empty list shown as what it will look like, clearly labelled a sample,
// with the one thing to do next. The sample is decorative (aria-hidden); the
// words below it say the same in plain text.
export function EmptyState({
  sample,
  title,
  body,
  cta,
}: {
  sample: ReactNode;
  title: string;
  body: string;
  cta?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="relative pt-3">
        <span className="absolute left-4 top-0 z-10 rounded-full border border-control bg-surface px-2.5 py-0.5 text-xs font-medium text-muted">
          Sample
        </span>
        <div aria-hidden="true" className="select-none">
          {sample}
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-text">{title}</p>
        <p className="max-w-[48ch] text-pretty text-sm text-muted">{body}</p>
      </div>
      {cta}
    </div>
  );
}

// A fake tip in the shape of the stream alert: Warm Night, a 4px lime left
// edge, the name, the amount in lime mono and the message.
export function SampleAlert({ name, amount, message }: { name: string; amount: number; message?: string }) {
  return (
    <div className="rounded-[var(--radius-field)] border-l-4 border-accent bg-ground px-4 py-3">
      <p className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-medium text-text">{name}</span>
        <span className="numeric shrink-0 text-accent">₹{amount}</span>
      </p>
      {message && <p className="mt-1 text-sm text-text">{message}</p>}
    </div>
  );
}
