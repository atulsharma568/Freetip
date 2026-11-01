"use client";

import { useEffect, useState } from "react";
import { goalPercent, REPEAT_LABEL, type GoalRepeat } from "@/lib/goal";

interface Goal {
  title: string;
  targetPaise: number;
  raisedPaise: number;
  repeat?: GoalRepeat;
  carryPaise?: number;
}

const POLL_MS = 5000;

function rupees(paise: number) {
  return Math.floor(paise / 100).toLocaleString("en-IN");
}

// Polls /api/overlay/<token>/goal and draws a bar for each goal, stacked. Shows
// nothing while there is no goal, so an OBS source can stay in the scene.
export function GoalBar({ token }: { token: string }) {
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

  if (goals.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: "4%",
        width: "min(90%, 960px)",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {goals.map((goal, i) => (
        <Bar key={i} goal={goal} />
      ))}
    </div>
  );
}

function Bar({ goal }: { goal: Goal }) {
  const pct = goalPercent(goal.raisedPaise, goal.targetPaise);

  return (
    <div
      data-testid="goal-bar"
      style={{
        padding: "14px 18px",
        borderRadius: 16,
        background: "rgba(10,10,10,0.82)",
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 22, fontWeight: 600 }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {goal.repeat && goal.repeat !== "never" ? `${goal.title} · ${REPEAT_LABEL[goal.repeat].toLowerCase()}` : goal.title}
        </span>
        <span style={{ whiteSpace: "nowrap" }}>
          ₹{rupees(goal.raisedPaise)} / ₹{rupees(goal.targetPaise)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={goal.title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        style={{ marginTop: 10, height: 16, borderRadius: 8, background: "rgba(255,255,255,0.18)", overflow: "hidden" }}
      >
        <div
          style={{ width: `${pct}%`, height: "100%", background: "var(--ov-accent, #bfe84a)", transition: "width 0.8s ease" }}
        />
      </div>
      {goal.carryPaise ? (
        <div style={{ marginTop: 6, fontSize: 15, opacity: 0.75 }}>
          includes ₹{rupees(goal.carryPaise)} carried over
        </div>
      ) : null}
    </div>
  );
}
