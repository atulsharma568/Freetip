"use client";

import { useActionState } from "react";
import { TickLoader } from "@/components/ui/TickLoader";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { buttonClass, FIELD_CLASS } from "@/components/admin/tones";
import { ADMIN_IDLE, type AdminAction } from "@/lib/admin/action-state";

// The owner has paid the transfer in their bank or UPI app: they enter its UTR and tick that the name
// the app showed matched the creator's, then the payout is recorded as paid.
export function MarkPaidForm({ action, creatorName }: { action: AdminAction; creatorName: string }) {
  const [state, formAction, pending] = useActionState(action, ADMIN_IDLE);
  return (
    <form action={formAction} className="space-y-3">
      <label className="block space-y-1 text-xs text-muted">
        UTR of the transfer you made
        <input
          name="utr"
          required
          minLength={6}
          maxLength={30}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="For example 412345678901"
          className={`${FIELD_CLASS} numeric block w-full max-w-xs`}
        />
      </label>
      <label className="flex items-start gap-2 text-sm text-text">
        <input type="checkbox" name="name_matched" required className="mt-1 size-4" />
        <span>The name my UPI app showed matched {creatorName}.</span>
      </label>
      <button type="submit" disabled={pending} className={buttonClass("primary", "md")}>
        {pending ? (
          <>
            <TickLoader count={6} duration={0.6} />
            Saving…
          </>
        ) : (
          "Mark as paid"
        )}
      </button>
      <ActionStatus state={state} />
    </form>
  );
}
