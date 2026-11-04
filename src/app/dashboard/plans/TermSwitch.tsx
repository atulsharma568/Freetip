"use client";

// The 1 month / 12 months switch. It sits above the plan cards and again inside the pay step, so a
// creator on a phone never has to scroll back up to change the term. Both are the same state.
export function TermSwitch({
  term,
  onChange,
  disabled = false,
  label = "Price shown for",
}: {
  term: 1 | 12;
  onChange: (next: 1 | 12) => void;
  disabled?: boolean;
  label?: string;
}) {
  const seg = (on: boolean) =>
    `h-10 rounded-full px-4 text-sm transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
      on ? "bg-accent font-semibold text-ink" : "text-muted hover:text-text"
    }`;
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-full border border-control p-0.5">
      <button type="button" aria-pressed={term === 1} disabled={disabled} onClick={() => onChange(1)} className={seg(term === 1)}>
        1 month
      </button>
      <button type="button" aria-pressed={term === 12} disabled={disabled} onClick={() => onChange(12)} className={seg(term === 12)}>
        12 months
      </button>
    </div>
  );
}
