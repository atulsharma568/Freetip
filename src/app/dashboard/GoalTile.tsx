"use client";

import { useActionState, useState, useTransition } from "react";
import { clearGoal, saveGoal, type GoalResult } from "@/app/actions/goal";
import { GOAL_TITLE_MAX } from "@/lib/goal";

interface Props {
  title: string;
  targetRupees: number | null;
}

export function GoalTile({ title, targetRupees }: Props) {
  const [state, action, pending] = useActionState<GoalResult | null, FormData>(saveGoal, null);
  const [removed, setRemoved] = useState<GoalResult | null>(null);
  const [removing, startRemove] = useTransition();
  const active = targetRupees !== null;
  const shown = removed ?? state;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        A progress bar for stream. Add your alert link to OBS as another Browser source and put{" "}
        <span className="numeric text-text">/goal</span> at the end of it. It counts tips from the
        moment you save, and shows nothing while there is no goal.
      </p>
      <form action={(f) => { setRemoved(null); action(f); }} className="space-y-3">
        <div className="space-y-2">
          <label htmlFor="goal-title" className="text-xs text-muted">Goal name</label>
          <input
            id="goal-title"
            name="goal_title"
            type="text"
            required
            maxLength={GOAL_TITLE_MAX}
            defaultValue={title}
            placeholder="New microphone"
            className="w-full h-12 rounded-[var(--radius-field)] border border-control bg-ground px-4 text-base text-text placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="goal-rupees" className="text-xs text-muted">Target (₹)</label>
          <input
            id="goal-rupees"
            name="goal_rupees"
            type="number"
            required
            min={10}
            step={1}
            inputMode="numeric"
            defaultValue={targetRupees ?? ""}
            placeholder="5000"
            className="numeric w-full h-12 rounded-[var(--radius-field)] border border-control bg-ground px-4 text-base text-text placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 items-center rounded-full bg-accent px-6 text-sm font-semibold text-ink disabled:opacity-40"
          >
            {pending ? "Saving…" : active ? "Save and restart from zero" : "Set goal"}
          </button>
          {active && (
            <button
              type="button"
              disabled={removing}
              onClick={() => startRemove(async () => setRemoved(await clearGoal()))}
              className="h-11 rounded-full border border-control px-5 text-sm text-text transition-colors hover:border-accent disabled:opacity-40"
            >
              Remove goal
            </button>
          )}
        </div>
      </form>
      {shown && (
        <p
          role={shown.status === "error" ? "alert" : "status"}
          className={`text-sm ${shown.status === "error" ? "text-red-400" : "text-muted"}`}
        >
          {shown.message}
        </p>
      )}
    </div>
  );
}
