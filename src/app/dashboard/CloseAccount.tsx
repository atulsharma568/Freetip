"use client";

import { useActionState, useState } from "react";
import { TickLoader } from "@/components/ui/TickLoader";
import { closeMyAccount } from "@/app/actions/creator";
import { CLOSE_ACCOUNT_IDLE } from "@/lib/creator-state";

// The last tile on the dashboard. Closing is permanent, so it is behind a button
// and then a typed word, and it uses outline buttons only (lime is for the main
// action on a screen, not for this).
export function CloseAccount() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [state, action, pending] = useActionState(closeMyAccount, CLOSE_ACCOUNT_IDLE);
  const ready = confirm.trim().toUpperCase() === "CLOSE";

  return (
    <section aria-labelledby="close-account-heading" className="rounded-[var(--radius-surface)] border border-line/60 bg-surface p-6">
      <h2 id="close-account-heading" className="text-sm font-medium uppercase tracking-widest text-muted">
        Close your account
      </h2>
      {!open ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted">
            Removes your profile, channel details, sounds, alert link and saved stream timestamps. You can&apos;t undo it.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-11 items-center rounded-full border border-control px-5 text-sm font-semibold text-text transition-[transform,border-color] hover:border-muted active:scale-[0.97]"
          >
            Close my account
          </button>
        </div>
      ) : (
        <form action={action} className="mt-4 space-y-4">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            <li>We delete your name, email, picture, YouTube channel, bio, sounds, alert link, saved stream timestamps, and the YouTube and Discord connections.</li>
            <li>Your tip page stops working. Your handle stays reserved, so nobody else can take it.</li>
            <li>We keep the tip, payout and tax records the law requires.</li>
            <li>If you have money on your balance or a payout in progress, contact us first.</li>
          </ul>
          <div className="space-y-2">
            <label htmlFor="close-confirm" className="text-sm font-medium text-text">
              Type CLOSE to confirm
            </label>
            <input
              id="close-confirm"
              name="confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="h-12 w-full rounded-[var(--radius-field)] border border-control bg-ground px-4 text-base text-text transition-[border-color] focus:border-accent"
            />
          </div>
          {state.status === "error" && (
            <p role="alert" className="text-sm text-text">
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
                  Closing…
                </>
              ) : (
                "Close my account for good"
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirm("");
              }}
              className="inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold text-muted transition-colors hover:text-text"
            >
              Keep my account
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
