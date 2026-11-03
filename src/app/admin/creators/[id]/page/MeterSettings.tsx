"use client";

import { useState } from "react";
import { buttonClass, FIELD_CLASS } from "@/components/admin/tones";
import type { GoalRepeat } from "@/lib/goal";
import { setMeterCelebrate, setMeterFill, setMeterGoal, setMeterLevels, type EditResult } from "@/lib/page-doc/edit";
import type { Block, PageDoc } from "@/lib/page-doc/types";
import { LadderEditor } from "./LadderEditor";

// One of the creator's goals as the editor lists it.
export interface EditorGoal {
  id: number;
  title: string;
  repeat: GoalRepeat;
}

const REPEATS: Record<GoalRepeat, string> = { never: "does not repeat", daily: "daily", weekly: "weekly", monthly: "monthly" };

// The goal id used to stand in for "the first goal" in the select.
const FIRST = "first";

// What belongs to the Pressure meter beyond the common word and choice fields: which goal it
// follows, its rank words, the celebration and the bar colour. It also says plainly when the page
// will show nothing, and why, so an empty preview is never a mystery.
export function MeterSettings({
  block,
  goals,
  switchOn,
  run,
}: {
  block: Block<"pressureMeter">;
  goals: EditorGoal[];
  switchOn: boolean;
  run: <R extends EditResult>(change: (doc: PageDoc) => R) => R;
}) {
  const { goal, levels, celebrate, fill, where } = block.settings;
  const [problem, setProblem] = useState<string | null>(null);
  const known = goal === null || goals.some((g) => g.id === goal);

  return (
    <div className="space-y-4">
      <ul className="space-y-1 text-xs text-muted">
        {!switchOn && (
          <li className="text-warn">
            <span aria-hidden="true">● </span>
            &ldquo;Pressure meter&rdquo; is switched off for this creator. The meter shows nowhere, and Publish is refused until it is on.
          </li>
        )}
        {goals.length === 0 && (
          <li>
            <span aria-hidden="true">● </span>
            This creator has no goal yet. They set one on their dashboard under Goal bars. Until then the meter shows nothing.
          </li>
        )}
        {!block.visible && <li>The meter is hidden (the eye in the list). It shows nowhere.</li>}
        {where === "obs" && <li>Set for OBS only, so the preview of the tip page shows no meter.</li>}
        {where === "page" && <li>Set for the tip page only, so the OBS link shows nothing.</li>}
        <li>
          In OBS: the creator&apos;s alert link with <span className="numeric">/pressure</span> added at the end. It follows the published page.
        </li>
      </ul>

      <label className="block space-y-1 text-xs text-muted">
        Which goal
        <select
          value={goal === null || !known ? FIRST : String(goal)}
          onChange={(e) => run((d) => setMeterGoal(d, e.target.value === FIRST ? null : Number(e.target.value)))}
          className={`${FIELD_CLASS} block w-full`}
        >
          <option value={FIRST}>The first goal</option>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title} ({REPEATS[g.repeat]})
            </option>
          ))}
        </select>
        <span className="block">
          {known
            ? "The words “today”, “this week” or “this month” follow the goal's own period."
            : "The goal this meter named is gone, so the first goal is used."}
        </span>
      </label>

      <label className="flex items-center gap-3 text-sm text-text">
        <input
          type="checkbox"
          checked={celebrate}
          onChange={(e) => run((d) => setMeterCelebrate(d, e.target.checked))}
          className="size-4 accent-[var(--color-accent)]"
        />
        Mark the moment the goal is reached
      </label>

      <div className="space-y-1 text-xs text-muted">
        <label htmlFor="meter-fill" className="block">
          Bar colour
        </label>
        <div className="flex items-center gap-2">
          <input
            id="meter-fill"
            type="color"
            value={fill ?? "#bfe84a"}
            onChange={(e) => {
              const r = run((d) => setMeterFill(d, e.target.value));
              setProblem(r.problems[0] ?? null);
            }}
            className="h-9 w-14 cursor-pointer rounded-field border border-control bg-ground"
          />
          <span className="numeric text-text">{fill ?? "the page colour"}</span>
          {fill !== null && (
            <button
              type="button"
              onClick={() => {
                run((d) => setMeterFill(d, null));
                setProblem(null);
              }}
              className={buttonClass("quiet", "sm")}
            >
              Use the page colour
            </button>
          )}
        </div>
        {problem && (
          <p role="alert" className="text-warn">
            <span aria-hidden="true">● </span>
            {problem}
          </p>
        )}
      </div>

      <LadderEditor
        variant="meter"
        ladder={{ topRupees: 100, levels }}
        onChange={(ladder) => {
          if (ladder) run((d) => setMeterLevels(d, ladder.levels));
        }}
      />
    </div>
  );
}
