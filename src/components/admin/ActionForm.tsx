"use client";

import { useActionState } from "react";
import { TickLoader } from "@/components/ui/TickLoader";
import { ADMIN_IDLE, type AdminAction } from "@/lib/admin/action-state";
import { ActionStatus } from "./ActionStatus";
import { buttonClass, FIELD_CLASS, type ButtonSize, type ButtonTone } from "./tones";

// One owner action with feedback: a pill button, an optional one-line note field,
// a tick loader while it runs and a status line after. For anything that cannot be
// undone use ConfirmAction instead.
export function ActionForm({
  action,
  label,
  pendingLabel,
  tone = "quiet",
  size = "sm",
  note,
  hidden,
}: {
  action: AdminAction;
  label: string;
  pendingLabel?: string;
  tone?: ButtonTone;
  size?: ButtonSize;
  // An optional text field sent with the action (for example a reason).
  note?: { name: string; label: string; placeholder: string; maxLength?: number };
  hidden?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, ADMIN_IDLE);
  return (
    <form action={formAction} className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        {note && (
          <input
            name={note.name}
            maxLength={note.maxLength ?? 300}
            placeholder={note.placeholder}
            aria-label={note.label}
            className={`${FIELD_CLASS} w-64 max-w-full`}
          />
        )}
        <button type="submit" disabled={pending} className={buttonClass(tone, size)}>
          {pending ? (
            <>
              <TickLoader count={6} duration={0.6} />
              {pendingLabel ?? "Working…"}
            </>
          ) : (
            label
          )}
        </button>
      </div>
      <ActionStatus state={state} />
    </form>
  );
}
