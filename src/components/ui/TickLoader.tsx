import type { CSSProperties } from "react";

// A row of ticks that light up one step at a time, left to right, over
// `duration` seconds, then hold full (see `.ticks` in globals.css). Every
// fourth tick is taller, like marks on a gauge. Drawn in currentColor, so it
// works as ink on lime or lime on dark. Decorative: put the words next to it.
export function TickLoader({
  count = 12,
  duration = 0.9,
  className = "",
}: {
  count?: number;
  duration?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`ticks ${className}`}
      style={{ "--tick-step": `${duration / count}s` } as CSSProperties}
    >
      {Array.from({ length: count }, (_, i) => (
        <span key={i} style={{ "--i": i } as CSSProperties} />
      ))}
    </span>
  );
}
