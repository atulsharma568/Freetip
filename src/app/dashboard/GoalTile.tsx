"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { removeGoal, saveGoal, type GoalResult } from "@/app/actions/goal";
import { GOAL_TIMEZONES, GOAL_TITLE_MAX, MAX_GOALS, REPEAT_LABEL, type GoalRepeat } from "@/lib/goal";
import { RollText } from "@/components/motion/RollText";
import { SelectField, Toggle } from "./parts/Controls";
import { Msg } from "./parts/Msg";
import { field as fieldClass, pillOutline, pillPrimary, pillText } from "./parts/styles";

export interface GoalView {
  id: number;
  title: string;
  targetRupees: number;
  repeat: GoalRepeat;
  timezone: string;
  carryOver: boolean;
  carryRupees: number;
  raisedRupees: number;
}

export interface GoalHistoryRow {
  repeat: GoalRepeat;
  periodStart: string;
  title: string;
  targetRupees: number;
  carryRupees: number;
  raisedRupees: number;
  hit: boolean;
  timezone: string;
}

// A finished period, named on the clock it was cut on ("Mon 3 Nov", "Nov 2026").
function periodName(row: GoalHistoryRow): string {
  const d = new Date(row.periodStart);
  // Start instants sit at local midnight, so a few hours in is safely the same day.
  const noon = new Date(d.getTime() + 6 * 60 * 60 * 1000);
  const opts: Intl.DateTimeFormatOptions =
    row.repeat === "monthly"
      ? { month: "short", year: "numeric" }
      : row.repeat === "weekly"
        ? { day: "numeric", month: "short" }
        : { weekday: "short", day: "numeric", month: "short" };
  const label = noon.toLocaleDateString("en-IN", { ...opts, timeZone: row.timezone });
  return row.repeat === "weekly" ? `Week of ${label}` : label;
}

function goalPercent(goal: GoalView): number {
  const total = goal.targetRupees + goal.carryRupees;
  if (total <= 0) return 0;
  return Math.min(100, Math.round((goal.raisedRupees / total) * 100));
}

function GoalForm({ goal }: { goal?: GoalView }) {
  const uid = useId();
  const [state, action, pending] = useActionState<GoalResult | null, FormData>(saveGoal, null);
  const [removed, setRemoved] = useState<GoalResult | null>(null);
  const [removing, startRemove] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [repeat, setRepeat] = useState<GoalRepeat>(goal?.repeat ?? "never");
  const [carry, setCarry] = useState(goal?.carryOver ?? false);
  const shown = removed ?? state;
  const id = (name: string) => `${uid}-${name}`;

  return (
    <div className="space-y-3">
      {goal && repeat === goal.repeat && goal.repeat !== "never" && (
        <div className="space-y-2">
          <p className="numeric text-sm text-text">
            {REPEAT_LABEL[goal.repeat]}: ₹{goal.raisedRupees.toLocaleString("en-IN")} of ₹
            {(goal.targetRupees + goal.carryRupees).toLocaleString("en-IN")}
            {goal.carryRupees > 0 && (
              <span className="text-muted"> (includes ₹{goal.carryRupees.toLocaleString("en-IN")} carried over)</span>
            )}
          </p>
          <div
            role="progressbar"
            aria-label={`${goal.title} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={goalPercent(goal)}
            className="h-2 overflow-hidden rounded-full bg-control"
          >
            <div className="h-full rounded-full bg-accent" style={{ width: `${goalPercent(goal)}%` }} />
          </div>
        </div>
      )}
      <form action={(f) => { setRemoved(null); action(f); }} className="space-y-3">
        {goal && <input type="hidden" name="goal_id" value={goal.id} />}
        <div className="space-y-2">
          <label htmlFor={id("title")} className="text-xs text-muted">Goal name</label>
          <input
            id={id("title")}
            name="goal_title"
            type="text"
            required
            maxLength={GOAL_TITLE_MAX}
            defaultValue={goal?.title ?? ""}
            placeholder="New microphone"
            className={fieldClass}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor={id("rupees")} className="text-xs text-muted">Target (₹)</label>
          <input
            id={id("rupees")}
            name="goal_rupees"
            type="number"
            required
            min={10}
            step={1}
            inputMode="numeric"
            defaultValue={goal?.targetRupees ?? ""}
            placeholder="5000"
            className={`numeric ${fieldClass}`}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor={id("repeat")} className="text-xs text-muted">Repeats</label>
          <SelectField
            id={id("repeat")}
            name="goal_repeat"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value as GoalRepeat)}
          >
            <option value="never">Does not repeat</option>
            <option value="daily">Every day</option>
            <option value="weekly">Every week (Monday)</option>
            <option value="monthly">Every month</option>
          </SelectField>
        </div>
        {repeat !== "never" && (
          <>
            <div className="space-y-2">
              <label htmlFor={id("zone")} className="text-xs text-muted">Resets at midnight in</label>
              <SelectField id={id("zone")} name="goal_timezone" defaultValue={goal?.timezone ?? "Asia/Kolkata"}>
                {GOAL_TIMEZONES.map((z) => (
                  <option key={z.id} value={z.id}>{z.label}</option>
                ))}
              </SelectField>
            </div>
            <Toggle
              id={id("carry")}
              name="goal_carry"
              checked={carry}
              onChange={setCarry}
              hint="If you fall short, the shortfall is added to the next period’s target (never more than one extra target)."
            >
              Carry over what is missed
            </Toggle>
          </>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={pending} className={`${pillPrimary} h-11`}>
            <RollText>{pending ? "Saving…" : goal ? "Save goal" : "Add goal"}</RollText>
          </button>
          {goal && !confirming && (
            <button type="button" onClick={() => setConfirming(true)} className={pillOutline}>
              Remove goal
            </button>
          )}
          {goal && confirming && (
            <>
              <button
                type="button"
                disabled={removing}
                onClick={() => startRemove(async () => setRemoved(await removeGoal(goal.id)))}
                className={pillOutline}
              >
                {removing ? "Removing…" : "Yes, remove it"}
              </button>
              <button type="button" disabled={removing} onClick={() => setConfirming(false)} className={pillText}>
                Keep it
              </button>
            </>
          )}
        </div>
      </form>
      <Msg kind={shown ? (shown.status === "error" ? "error" : "info") : undefined} text={shown?.message} />
    </div>
  );
}

export function GoalTile({ goals, history }: { goals: GoalView[]; history: GoalHistoryRow[] }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Progress bars for stream, up to {MAX_GOALS} at once (they stack). Add your alert link to OBS as another
        Browser source and put <span className="numeric text-text">/goal</span> at the end of it. A goal can start
        again every day, week (from Monday) or month, at midnight in the timezone you pick, and can carry what you
        missed into the next period. With &ldquo;Does not repeat&rdquo; it counts tips from the moment you save. The
        source shows nothing while there are no goals.
      </p>
      {goals.map((g) => (
        <div key={g.id} className="rounded-[var(--radius-field)] border border-line/60 p-4">
          <GoalForm goal={g} />
        </div>
      ))}
      {goals.length < MAX_GOALS && (
        <div className="rounded-[var(--radius-field)] border border-line/60 p-4 space-y-3">
          <p className="text-xs text-muted">{goals.length === 0 ? "Set a goal" : "Add another goal"}</p>
          <GoalForm key={goals.length} />
        </div>
      )}
      {history.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted">Past periods</p>
          <ul className="space-y-1 text-sm">
            {history.map((h) => (
              <li key={`${h.title}-${h.repeat}-${h.periodStart}`} className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
                <span className="min-w-0 break-words text-muted">
                  {h.title} · {periodName(h)}
                </span>
                <span className="numeric min-w-0 break-words text-text">
                  ₹{h.raisedRupees.toLocaleString("en-IN")} / ₹{h.targetRupees.toLocaleString("en-IN")} {h.hit ? "✓ reached" : "missed"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
