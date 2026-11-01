import type { ReactNode } from "react";

export type MsgKind = "error" | "ok" | "info";

// A status line that is always in the page, so a screen reader announces
// whatever lands in it (a live region added together with its text is often
// missed). Empty, it takes no room. DESIGN has no red: a problem is Chalk text
// behind a small "Problem" pill; a success is Chalk text with a solid lime dot.
export function Msg({
  kind,
  text,
  className = "",
}: {
  kind?: MsgKind;
  text?: ReactNode;
  className?: string;
}) {
  const shown = kind && text;
  return (
    <div aria-live="polite" aria-atomic="true" className={`empty:sr-only ${className}`}>
      {shown && kind === "error" && (
        <p className="flex items-start gap-2 text-sm text-text">
          <span className="mt-px shrink-0 rounded-full bg-text px-2 py-0.5 text-xs font-semibold text-ground">
            Problem
          </span>
          <span className="min-w-0 break-words">{text}</span>
        </p>
      )}
      {shown && kind === "ok" && (
        <p className="flex items-start gap-2 text-sm text-text">
          <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
          <span className="min-w-0 break-words">{text}</span>
        </p>
      )}
      {shown && kind === "info" && <p className="break-words text-sm text-muted">{text}</p>}
    </div>
  );
}
