"use client";

import { useActionState, useId, useRef, useState } from "react";
import { TickLoader } from "@/components/ui/TickLoader";
import { ADMIN_IDLE, type AdminAction, type AdminActionState } from "@/lib/admin/action-state";
import { ActionStatus } from "./ActionStatus";
import { buttonClass, FIELD_CLASS, type ButtonSize, type ButtonTone } from "./tones";

// A two-step button for anything that is hard to undo. The first press opens a
// short panel in place (no modal) that says what will happen; the second press does
// it. `typeToConfirm` adds a gate: the owner types that text (for example the
// handle) before the confirm button works. `askReason` adds an optional reason that
// is sent as `reason` and recorded in audit_events.reason.
export function ConfirmAction({
  action,
  label,
  description,
  confirmLabel,
  pendingLabel,
  tone = "danger",
  size = "sm",
  typeToConfirm,
  askReason = false,
  hidden,
  disabled = false,
}: {
  action: AdminAction;
  label: string;
  description: string;
  confirmLabel: string;
  pendingLabel?: string;
  tone?: ButtonTone;
  size?: ButtonSize;
  typeToConfirm?: string;
  askReason?: boolean;
  hidden?: Record<string, string>;
  // The first button cannot be pressed (for example while the form above it is not valid).
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, ADMIN_IDLE);
  // The state the panel was opened under. A new "ok" result closes it (the thing is
  // done); an error leaves it open so the owner can read why and try again.
  const [openedUnder, setOpenedUnder] = useState<AdminActionState | null>(null);
  const [typed, setTyped] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const open = openedUnder !== null && !(state.status === "ok" && state !== openedUnder);
  const gated = typeToConfirm !== undefined && typed.trim() !== typeToConfirm;

  function close() {
    setOpenedUnder(null);
    setTyped("");
    trigger.current?.focus();
  }

  return (
    <div className="space-y-2">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={disabled}
        onClick={() => (open ? close() : setOpenedUnder(state))}
        className={buttonClass(tone, size)}
      >
        {label}
      </button>

      {open && (
        <form
          id={panelId}
          action={formAction}
          className="max-w-xs space-y-3 rounded-surface border border-control bg-raised p-4"
        >
          <p className="text-sm text-text">{description}</p>
          {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          {typeToConfirm !== undefined && (
            <label className="block space-y-1 text-xs text-muted">
              Type <span className="numeric text-text">{typeToConfirm}</span> to confirm
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                // The owner just pressed the button that opened this panel.
                autoFocus
                className={`${FIELD_CLASS} numeric block w-full`}
              />
            </label>
          )}
          {askReason && (
            <label className="block space-y-1 text-xs text-muted">
              Reason (optional, kept in the audit history)
              <input name="reason" maxLength={300} className={`${FIELD_CLASS} block w-full`} />
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending || gated}
              autoFocus={typeToConfirm === undefined}
              className={buttonClass(tone, size)}
            >
              {pending ? (
                <>
                  <TickLoader count={6} duration={0.6} />
                  {pendingLabel ?? "Working…"}
                </>
              ) : (
                confirmLabel
              )}
            </button>
            <button type="button" onClick={close} disabled={pending} className={buttonClass("quiet", size)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      <ActionStatus state={state} />
    </div>
  );
}
