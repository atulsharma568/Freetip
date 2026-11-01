"use client";

import { useActionState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { buttonClass } from "@/components/admin/tones";
import { ADMIN_IDLE, type AdminAction } from "@/lib/admin/action-state";
import { FEATURES } from "@/lib/plans";

const BUILT = FEATURES.filter((f) => f.built);

// One creator's switches in a row: tick, then Save. Same action as the creator's own page.
export function RowForm({ action, granted }: { action: AdminAction; granted: string[] }) {
  const [state, formAction, pending] = useActionState(action, ADMIN_IDLE);
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {BUILT.map((f) => (
          <label key={f.key} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="feature"
              value={f.key}
              defaultChecked={granted.includes(f.key)}
              className="mt-1 h-4 w-4 accent-[var(--color-accent)]"
            />
            <span className="text-text">{f.label}</span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" name="intent" value="save" disabled={pending} className={buttonClass("primary", "sm")}>
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="submit" name="intent" value="all" disabled={pending} className={buttonClass("quiet", "sm")}>
          Turn on everything
        </button>
      </div>
      <ActionStatus state={state} />
    </form>
  );
}
