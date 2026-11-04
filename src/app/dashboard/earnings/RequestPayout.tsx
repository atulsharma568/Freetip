"use client";

import { useActionState } from "react";
import { TickLoader } from "@/components/ui/TickLoader";
import { ADMIN_IDLE } from "@/lib/admin/action-state";
import { requestMyPayout } from "@/app/actions/payouts";

// The button that asks for a payout. The amount on it is only what the page worked out; the server
// works it out again from the books when the button is pressed, and says so if it differs.
export function RequestPayout({ amountLabel, upiVpa }: { amountLabel: string; upiVpa: string }) {
  const [state, formAction, pending] = useActionState(requestMyPayout, ADMIN_IDLE);
  return (
    <form action={formAction} className="space-y-3">
      <button
        type="submit"
        disabled={pending || state.status === "ok"}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-base font-semibold text-ink transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? (
          <>
            <TickLoader count={6} duration={0.6} />
            Requesting…
          </>
        ) : (
          `Request payout of ${amountLabel}`
        )}
      </button>
      <p className="text-sm text-muted">
        It is paid to <span className="numeric text-text">{upiVpa}</span>.
      </p>
      <p aria-live="polite" className="text-sm">
        {state.status === "ok" && <span className="text-accent">✓ {state.message}</span>}
        {state.status === "error" && (
          <span className="text-bad">
            <span className="sr-only">Error: </span>
            {state.message}
          </span>
        )}
      </p>
    </form>
  );
}
