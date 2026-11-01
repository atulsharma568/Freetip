"use client";

import { useActionState, useState, useTransition } from "react";
import { clearGoal, saveGoal, type GoalResult } from "@/app/actions/goal";
import { GOAL_TITLE_MAX, REPEAT_LABEL, type GoalRepeat } from "@/lib/goal";

export interface GoalHistoryRow {
  repeat: GoalRepeat;
  periodStart: string;
  title: string;
  targetRupees: number;
  raisedRupees: number;
  hit: boolean;
}

interface Props {
  title: string;
  targetRupees: number | null;
  repeat: GoalRepeat;
  raisedRupees: number;
  history: GoalHistoryRow[];
}

// A finished period, named in India time ("Mon 3 Nov", "Nov 2026").
function periodName(row: GoalHistoryRow): string {
  const d = new Date(row.periodStart);
  const opts: Intl.DateTimeFormatOptions =
    row.repeat === "monthly"
      ? { month: "short", year: "numeric" }
      : row.repeat === "weekly"
        ? { day: "numeric", month: "short" }
        : { weekday: "short", day: "numeric", month: "short" };
  const label = d.toLocaleDateString("en-IN", { ...opts, timeZone: "Asia/Kolkata" });
  return row.repeat === "weekly" ? `Week of ${label}` : label;
}

export function GoalTile({ title, targetRupees, repeat, raisedRupees, history }: Props) {
  const [state, action, pending] = useActionState<GoalResult | null, FormData>(saveGoal, null);
  const [removed, setRemoved] = useState<GoalResult | null>(null);
  const [removing, startRemove] = useTransition();
  const active = targetRupees !== null;
  const shown = removed ?? state;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        A progress bar for stream. Add your alert link to OBS as another Browser source and put{" "}
        <span className="numeric text-text">/goal</span> at the end of it. Choose how often it
        starts again: it then resets by itself at midnight India time (weeks start on Monday).
        With &ldquo;Does not repeat&rdquo; it counts tips from the moment you save. It shows nothing while
        there is no goal.
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
        <div className="space-y-2">
          <label htmlFor="goal-repeat" className="text-xs text-muted">Repeats</label>
          <select
            id="goal-repeat"
            name="goal_repeat"
            defaultValue={repeat}
            className="w-full h-12 rounded-[var(--radius-field)] border border-control bg-ground px-4 text-base text-text focus:border-accent focus:outline-none"
          >
            <option value="never">Does not repeat</option>
            <option value="daily">Every day</option>
            <option value="weekly">Every week (Monday)</option>
            <option value="monthly">Every month</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 items-center rounded-full bg-accent px-6 text-sm font-semibold text-ink disabled:opacity-40"
          >
            {pending ? "Saving…" : active ? "Save goal" : "Set goal"}
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
      {active && repeat !== "never" && (
        <p className="numeric text-sm text-text">
          {REPEAT_LABEL[repeat]}: ₹{raisedRupees.toLocaleString("en-IN")} of ₹{targetRupees?.toLocaleString("en-IN")}
        </p>
      )}
      {history.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted">Past periods</p>
          <ul className="space-y-1 text-sm">
            {history.map((h) => (
              <li key={`${h.repeat}-${h.periodStart}`} className="flex justify-between gap-3">
                <span className="text-muted">{periodName(h)}</span>
                <span className="numeric text-text">
                  ₹{h.raisedRupees.toLocaleString("en-IN")} / ₹{h.targetRupees.toLocaleString("en-IN")} {h.hit ? "✓ reached" : "missed"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
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
