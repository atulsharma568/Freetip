"use client";

import { useActionState, useState } from "react";
import { TickLoader } from "@/components/ui/TickLoader";
import { HandleField } from "@/components/ui/HandleField";
import { renameMyHandle } from "@/app/actions/creator";
import { HANDLE_IDLE } from "@/lib/creator-state";
import { SITE_HOST } from "@/lib/site";

// A handle can be changed once, ever. It sits behind a button and a retyped name
// because the old link and QR code stop working at once. Outline buttons only: lime
// is for the main action on a screen.
export function RenameHandle({ current, used }: { current: string; used: boolean }) {
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, action, pending] = useActionState(renameMyHandle, HANDLE_IDLE);
  const next = handle.toLowerCase().trim();
  const ready = next.length >= 3 && next !== current && confirm.toLowerCase().trim() === next;

  if (used || state.status === "ok") {
    return (
      <p className="text-sm text-muted">
        {state.status === "ok"
          ? `Done. Your tip page is now ${SITE_HOST}/${state.handle}. Print the new QR code.`
          : "You have already used your one handle change."}
      </p>
    );
  }

  if (!open) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">You can change your handle once. After that it is fixed.</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-11 items-center rounded-full border border-control px-5 text-sm font-semibold text-text transition-[transform,border-color] hover:border-muted active:scale-[0.97]"
        >
          Change my handle
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
        <li>You can only do this once. You cannot change it back or change it again.</li>
        <li>
          Your old link {SITE_HOST}/{current} and old QR code stop working at once, and every link you shared
          stops working too.
        </li>
        <li>Nobody else can take your old handle.</li>
        <li>Your alert link and your tips are not affected.</li>
      </ul>
      <div className="space-y-2">
        <label htmlFor="rename-handle" className="text-sm font-medium text-text">
          New handle
        </label>
        <HandleField
          id="rename-handle"
          value={handle}
          onChange={setHandle}
          tone="dark"
          invalid={state.status === "error"}
          describedBy={state.status === "error" ? "rename-error" : undefined}
          scanning={pending}
        />
        <p className="px-2 text-xs text-muted">3 to 20 letters, numbers or underscores.</p>
      </div>
      <div className="space-y-2">
        <label htmlFor="rename-confirm" className="text-sm font-medium text-text">
          Type the new handle again to confirm
        </label>
        <input
          id="rename-confirm"
          name="confirm"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className="h-12 w-full rounded-[var(--radius-field)] border border-control bg-ground px-4 text-base text-text transition-[border-color] focus:border-accent"
        />
      </div>
      {state.status === "error" && (
        <p id="rename-error" role="alert" className="text-sm text-text">
          {state.message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={!ready || pending}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-control px-5 text-sm font-semibold text-text transition-[transform,border-color] hover:border-muted active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? (
            <>
              <TickLoader count={8} duration={0.8} />
              Changing…
            </>
          ) : (
            "Change my handle for good"
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setHandle("");
            setConfirm("");
          }}
          className="inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold text-muted transition-colors hover:text-text"
        >
          Keep {current}
        </button>
      </div>
    </form>
  );
}
