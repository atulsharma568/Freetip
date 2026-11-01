"use client";

import { useActionState, useState } from "react";
import { TickLoader } from "@/components/ui/TickLoader";
import { HandleField } from "@/components/ui/HandleField";
import { requestMyHandleChange } from "@/app/actions/creator";
import { HANDLE_IDLE } from "@/lib/creator-state";
import { SITE_HOST } from "@/lib/site";

export type HandleRequestView = { status: "pending" | "rejected"; requested: string; note: string | null } | null;

// A creator cannot change the handle directly: they send a request and the owner
// decides. One change, ever; a rejected request does not use it up. Outline buttons
// only: lime is for the main action on a screen.
export function RenameHandle({
  current,
  used,
  request,
}: {
  current: string;
  used: boolean;
  request: HandleRequestView;
}) {
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, action, pending] = useActionState(requestMyHandleChange, HANDLE_IDLE);
  const next = handle.toLowerCase().trim();
  const ready = next.length >= 3 && next !== current && confirm.toLowerCase().trim() === next;

  if (used) {
    return <p className="text-sm text-muted">You have already used your one handle change.</p>;
  }

  if (state.status === "ok" || request?.status === "pending") {
    const asked = state.status === "ok" ? state.handle : request?.requested;
    return (
      <p className="text-sm text-muted">
        Your request to change your handle to <span className="numeric text-text">{asked}</span> is waiting for our
        approval. Your link {SITE_HOST}/{current} keeps working until then.
      </p>
    );
  }

  if (!open) {
    return (
      <div className="space-y-3">
        {request?.status === "rejected" && (
          <p role="status" className="text-sm text-text">
            Your request for {request.requested} was not approved
            {request.note ? `: ${request.note}` : "."} You can send another.
          </p>
        )}
        <p className="text-sm text-muted">
          You can ask to change your handle once. We approve each request, and after a change it is fixed.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-11 items-center rounded-full border border-control px-5 text-sm font-semibold text-text transition-[transform,border-color] hover:border-muted active:scale-[0.97]"
        >
          Request a handle change
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
        <li>We review every request. Your current link keeps working until we approve it.</li>
        <li>You get one change, ever. You cannot change it back or change it again.</li>
        <li>
          Once approved, your old link {SITE_HOST}/{current} and old QR code stop working at once, and every link
          you shared stops working too.
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
              Sending…
            </>
          ) : (
            "Send request"
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
