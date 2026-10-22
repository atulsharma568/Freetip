"use client";

import { useActionState, useState } from "react";
import { TickLoader } from "@/components/ui/TickLoader";
import { HandleField } from "@/components/ui/HandleField";
import { setHandle, HANDLE_IDLE } from "@/app/actions/creator";
import { SITE_NAME } from "@/lib/site";

export function HandleSetup() {
  const [state, action, pending] = useActionState(setHandle, HANDLE_IDLE);
  const [handle, setHandleValue] = useState("");

  return (
    <div className="mx-auto w-full max-w-lg space-y-10 px-6 py-16">
      <div className="space-y-3">
        <h1 className="display text-[clamp(2rem,8vw,3rem)]">
          Claim your link.
        </h1>
        <p className="text-pretty text-lg text-muted">
          This becomes your public tip page on {SITE_NAME}. You can&apos;t
          change it later, so choose carefully.
        </p>
      </div>

      <form action={action} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="handle-input" className="sr-only">
            Your handle
          </label>
          <HandleField
            id="handle-input"
            value={handle}
            onChange={setHandleValue}
            tone="dark"
            invalid={state.status === "error"}
            describedBy={state.status === "error" ? "handle-error" : undefined}
            scanning={pending}
          />
          <p className="px-2 text-xs text-muted">
            3–20 letters, numbers or underscores. You can&apos;t change this later.
          </p>
          {state.status === "error" && (
            <p id="handle-error" role="alert" className="px-2 text-sm text-red-400">
              {state.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={pending || handle.length < 3}
          className="beam inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-accent px-8 text-base font-semibold text-ink transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? (
            <>
              <TickLoader count={10} duration={0.8} className="text-ink" />
              Claiming…
            </>
          ) : (
            "Claim handle →"
          )}
        </button>
      </form>
    </div>
  );
}
