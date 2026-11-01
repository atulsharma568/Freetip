import { rupeeText } from "./format";

// The alert as it will look on the streamer's screen (same dark card, lime edge,
// name, amount and message as the OBS overlay). Decorative: the form fields say
// the same things in words, so it is hidden from screen readers.
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
      className={`rounded-[var(--radius-field)] border border-l-4 border-line/60 border-l-accent bg-ground px-4 py-4 text-left sm:px-5 ${className}`}
    >
      <p className="flex items-baseline justify-between gap-4">
        <span className="min-w-0 truncate text-base font-semibold text-text">{name}</span>
        <span
          className="amount-numeral numeric shrink-0 text-2xl font-semibold text-accent"
          key={amountRupees}
        >
          ₹{rupeeText(amountRupees)}
        </span>
      </p>
      <p className={`mt-2 break-words text-sm leading-snug ${message ? "text-muted" : "text-control"}`}>
        {message || "Your message shows up here."}
      </p>
    </div>
  );
}
