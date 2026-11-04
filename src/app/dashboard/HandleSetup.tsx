"use client";

import { useActionState, useState } from "react";
import { TickLoader } from "@/components/ui/TickLoader";
import { HandleField } from "@/components/ui/HandleField";
import { setHandle } from "@/app/actions/creator";
import { HANDLE_IDLE } from "@/lib/creator-state";
import { SITE_NAME } from "@/lib/site";
import { RollText } from "@/components/motion/RollText";
import { Msg } from "./parts/Msg";

export function HandleSetup() {
  const [state, action, pending] = useActionState(setHandle, HANDLE_IDLE);
  const [handle, setHandleValue] = useState("");
  const [upiVpa, setUpiVpa] = useState("");

  return (
    <div className="mx-auto w-full max-w-lg space-y-10 px-6 py-16">
      <div className="space-y-3">
        <h1 className="display text-[clamp(2rem,8vw,3rem)]">
          Claim your link.
        </h1>
        <p className="text-pretty text-lg text-muted">
          This becomes your public tip page on {SITE_NAME}. You can ask to change it
          once later, and we approve it, so choose carefully.
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
            3–20 letters, numbers or underscores. You can ask to change it once later.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="claim-upi-vpa" className="px-2 text-sm font-medium uppercase tracking-widest text-muted">
            Your UPI ID
          </label>
          <input
            id="claim-upi-vpa"
            name="upi_vpa"
            type="text"
            required
            inputMode="email"
            value={upiVpa}
            onChange={(e) => setUpiVpa(e.target.value.toLowerCase())}
            placeholder="yourname@upi"
            autoComplete="off"
            className="w-full h-12 rounded-[var(--radius-field)] border border-control bg-ground px-4 font-mono text-base text-text placeholder:text-muted transition-[border-color] focus:border-accent"
          />
          <p className="px-2 text-xs text-muted">
            Required. Your tips are paid out to this UPI ID. You can find it in your UPI app.
          </p>
          <div id="handle-error" className="px-2">
            <Msg kind={state.status === "error" ? "error" : undefined} text={state.status === "error" ? state.message : undefined} />
          </div>
        </div>

        <button
          type="submit"
          disabled={pending || handle.length < 3 || !upiVpa.trim()}
          className="beam inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-accent px-8 text-base font-semibold text-ink transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? (
            <>
              <TickLoader count={10} duration={0.8} className="text-ink" />
              Claiming…
            </>
          ) : (
            <RollText>Claim handle →</RollText>
          )}
        </button>
      </form>
    </div>
  );
}
