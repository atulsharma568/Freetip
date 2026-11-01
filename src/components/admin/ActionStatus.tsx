import type { AdminActionState } from "@/lib/admin/action-state";
import { TONE_MARK, TONE_TEXT } from "./tones";

// The line under an owner action: what happened, or why nothing did. The live
// region is always on the page (a region added together with its text is often not
// announced), and an error is marked and worded, not only coloured.
export function ActionStatus({ state, className = "" }: { state: AdminActionState; className?: string }) {
  return (
    <p aria-live="polite" className={`min-h-0 text-xs ${className}`}>
      {state.status === "ok" && (
        <span className={TONE_TEXT.good}>
          <span aria-hidden="true">{TONE_MARK.good} </span>
          {state.message}
        </span>
      )}
      {state.status === "error" && (
        <span className={TONE_TEXT.bad}>
          <span aria-hidden="true">{TONE_MARK.bad} </span>
          <span className="sr-only">Error: </span>
          {state.message}
        </span>
      )}
    </p>
  );
}
