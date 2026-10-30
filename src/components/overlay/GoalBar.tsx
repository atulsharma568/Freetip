"use client";

import { useEffect, useState } from "react";
import { goalPercent } from "@/lib/goal";

interface Goal {
  title: string;
  targetPaise: number;
  raisedPaise: number;
}

const POLL_MS = 5000;

function rupees(paise: number) {
  return Math.floor(paise / 100).toLocaleString("en-IN");
}

// Polls /api/overlay/<token>/goal and draws one bar. Shows nothing while there is
// no goal, so an OBS source can stay in the scene.
export function GoalBar({ token }: { token: string }) {
  const [goal, setGoal] = useState<Goal | null>(null);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const res = await fetch(`/api/overlay/${token}/goal`, { cache: "no-store" });
        if (!stop && res.ok) setGoal((await res.json()).goal ?? null);
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

  if (!goal) return null;
  const pct = goalPercent(goal.raisedPaise, goal.targetPaise);

  return (
    <div
      data-testid="goal-bar"
      style={{
        position: "absolute",
        left: "50%",
        bottom: "4%",
        width: "min(90%, 960px)",
        transform: "translateX(-50%)",
        padding: "14px 18px",
        borderRadius: 16,
        background: "rgba(10,10,10,0.82)",
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 22, fontWeight: 600 }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{goal.title}</span>
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
          style={{ width: `${pct}%`, height: "100%", background: "#bfe84a", transition: "width 0.8s ease" }}
        />
      </div>
    </div>
  );
}
