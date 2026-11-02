"use client";

import { useActionState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { buttonClass } from "@/components/admin/tones";
import { setTtsFloor } from "@/app/actions/admin";
import { ADMIN_IDLE } from "@/lib/admin/action-state";

export function TtsFloorForm({ rupees }: { rupees: number }) {
  const [state, action, pending] = useActionState(setTtsFloor, ADMIN_IDLE);
  return (
    <form action={action} className="space-y-3">
      <label className="block space-y-1">
        <span className="text-sm text-text">Smallest tip that can be read aloud (₹)</span>
        <input
          name="floor"
          inputMode="numeric"
          defaultValue={rupees}
          pattern="[0-9]*"
          className="numeric w-32 rounded-surface border border-control bg-surface px-3 py-2 text-sm"
        />
      </label>
      <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
        {pending ? "Saving…" : "Save"}
      </button>
      <ActionStatus state={state} />
    </form>
  );
}
