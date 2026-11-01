import type { NextStep } from "@/lib/next-step";

export function NextStepCard({ step }: { step: NextStep }) {
  return (
    <section
      aria-labelledby="next-step-title"
      className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-surface)] border border-accent/60 bg-surface p-6"
    >
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium uppercase tracking-widest text-muted">Next step</p>
        <h2 id="next-step-title" className="text-lg font-semibold text-text">
          {step.title}
        </h2>
        <p className="text-sm text-muted">{step.body}</p>
      </div>
      <a
        href={step.href}
        className="inline-flex h-11 items-center rounded-full bg-accent px-6 text-sm font-semibold text-ink"
      >
        {step.action}
      </a>
    </section>
  );
}
