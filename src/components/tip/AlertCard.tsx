import { rupeeText } from "./format";

// The alert as it will look on the streamer's screen: a small stream frame with the
// lime card in its corner (same card, ink text, name, amount and message as the OBS
// overlay). Decorative: the form fields say the same things in words, so it is hidden
// from screen readers.
export function AlertCard({
  name,
  amountRupees,
  message,
  className = "",
}: {
  name: string;
  amountRupees: number;
  message: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`flex min-h-48 flex-col justify-between gap-6 rounded-[var(--radius-surface)] border border-line/60 bg-ground p-4 ${className}`}
    >
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted">
        <span className="live-dot" />
        On stream
      </p>
      <div className="on-accent rounded-[var(--radius-field)] bg-accent px-4 py-4 text-left text-ink sm:px-5">
        <p className="flex items-baseline justify-between gap-4">
          <span className="min-w-0 truncate text-base font-semibold">
            {name} <span className="font-normal text-ink/85">tipped</span>
          </span>
          <span className="amount-numeral numeric shrink-0 text-2xl font-semibold" key={amountRupees}>
            ₹{rupeeText(amountRupees)}
          </span>
        </p>
        <p className={`mt-2 break-words text-sm leading-snug ${message ? "" : "text-ink/85"}`}>
          {message || "Your message shows up here."}
        </p>
      </div>
    </div>
  );
}
