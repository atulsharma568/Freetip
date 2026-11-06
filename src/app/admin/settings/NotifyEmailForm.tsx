"use client";

import { useActionState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { buttonClass } from "@/components/admin/tones";
import { setNotifyEmail } from "@/app/actions/admin";
import { ADMIN_IDLE } from "@/lib/admin/action-state";

export function NotifyEmailForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(setNotifyEmail, ADMIN_IDLE);
  return (
    <form action={action} className="space-y-3">
      <label className="block space-y-1">
        <span className="text-sm text-text">Email address</span>
        <input
          name="email"
          type="email"
          autoComplete="off"
          defaultValue={email}
          placeholder="name@gmail.com"
          className="w-full max-w-sm rounded-surface border border-control bg-surface px-3 py-2 text-sm"
        />
      </label>
      <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
        {pending ? "Saving…" : "Save"}
      </button>
      <ActionStatus state={state} />
    </form>
  );
}
