"use client";

import { useEffect, useState } from "react";
import { goalPercent, REPEAT_LABEL, type GoalRepeat } from "@/lib/goal";
import { Bump, PANEL_CSS } from "./panel";
import { STAGE_CSS, stageStyle, useStageSize } from "./stage";

interface Goal {
  title: string;
  targetPaise: number;
  raisedPaise: number;
  repeat?: GoalRepeat;
  carryPaise?: number;
}

const POLL_MS = 5000;
// How long the card stays flipped to lime after a goal is reached.
const REACHED_MS = 6000;

function rupees(paise: number) {
  return Math.floor(paise / 100).toLocaleString("en-IN");
}

// Polls /api/overlay/<token>/goal and draws a bar for each goal, stacked. Shows
// nothing while there is no goal, so an OBS source can stay in the scene.
export function GoalBar({ token }: { token: string }) {
  const { ref, w, portrait } = useStageSize();
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const res = await fetch(`/api/overlay/${token}/goal`, { cache: "no-store" });
        if (!stop && res.ok) setGoals((await res.json()).goals ?? []);
      } catch {
        // Keep the last bar on a network blip.
      }
      if (!stop) timer = setTimeout(poll, POLL_MS);
    }
    poll();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [token]);

  return (
    <div ref={ref} className={`ov-stage${portrait ? " ov-portrait" : ""}`} style={stageStyle(w, portrait)}>
      <style>{STAGE_CSS + PANEL_CSS + CSS}</style>
      {goals.length > 0 && (
        <div className="ov-dock ov-dock-bc">
          {goals.map((goal, i) => (
            <Bar key={i} goal={goal} />
          ))}
        </div>
      )}
    </div>
  );
}

function Bar({ goal }: { goal: Goal }) {
  const pct = goalPercent(goal.raisedPaise, goal.targetPaise);
  // One-off flip: only when this overlay watches the bar cross the line, never when it
  // loads with the goal already met.
  const [prevPct, setPrevPct] = useState(pct);
  const [reached, setReached] = useState(false);
  if (prevPct !== pct) {
    setPrevPct(pct);
    if (prevPct < 100 && pct >= 100) setReached(true);
  }
  useEffect(() => {
    if (!reached) return;
    const t = setTimeout(() => setReached(false), REACHED_MS);
    return () => clearTimeout(t);
  }, [reached]);

  const title =
    goal.repeat && goal.repeat !== "never" ? `${goal.title} · ${REPEAT_LABEL[goal.repeat].toLowerCase()}` : goal.title;

  return (
    <div data-testid="goal-bar" className={`ov-panel ov-goal${reached ? " ov-reached" : ""}`}>
      <div className="ov-row ov-goal-line">
        <span className="ov-clip">{title}</span>
        {reached && <span className="ov-reach ov-mono">GOAL REACHED</span>}
        <span className="ov-mono ov-goal-sums">
          <Bump value={goal.raisedPaise}>₹{rupees(goal.raisedPaise)}</Bump> / ₹{rupees(goal.targetPaise)}
        </span>
      </div>
      <div
        className="ov-track"
        role="progressbar"
        aria-label={goal.title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        style={{ marginTop: "calc(var(--f) * 1)" }}
      >
        <div className="ov-fill" style={{ width: `${pct}%` }} />
      </div>
      {goal.carryPaise ? <p className="ov-carry">includes ₹{rupees(goal.carryPaise)} carried over</p> : null}
    </div>
  );
}

const CSS = `
.ov-goal-line { font-size: calc(var(--f) * 1.8); font-weight: 600; }
.ov-goal-sums { white-space: nowrap; }
.ov-reach { margin: 0 auto 0 calc(var(--f) * 1); padding: calc(var(--f) * 0.2) calc(var(--f) * 0.8); border-radius: 9999px; background: var(--ov-on-lime); color: var(--ov-lime); font-size: calc(var(--f) * 1.05); font-weight: 600; letter-spacing: 0.1em; white-space: nowrap; }
.ov-carry { margin: calc(var(--f) * 0.7) 0 0; font-size: calc(var(--f) * 1.3); color: var(--ov-ash); }
.ov-reached { background: var(--ov-lime); color: var(--ov-on-lime); }
.ov-reached .ov-carry { color: var(--ov-on-lime); }
.ov-reached .ov-track { background: transparent; border-color: var(--ov-on-lime); }
.ov-reached .ov-fill { background: var(--ov-on-lime); }
`;
