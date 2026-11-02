"use client";

import { useEffect, useState } from "react";
import type { RecentSupporter, Streak, TopSupporter } from "@/lib/supporters";
import { Bump, PANEL_CSS } from "./panel";
import { STAGE_CSS, stageStyle, useStageSize } from "./stage";

export type SupporterKind = "streak" | "top" | "recent";

type Data = { streak?: Streak; top?: TopSupporter | null; recent?: RecentSupporter[] };

const POLL_MS = 5000;
// After a 404 (link replaced, or the creator paused) ask only once a minute, so a dead link
// in OBS does not hammer the server, yet a creator who comes back shows up without a reload.
const GONE_POLL_MS = 60000;

const rupees = (paise: number) => Math.floor(paise / 100).toLocaleString("en-IN");

// One of the three supporter overlays. Polls /api/overlay/<token>/supporters and draws
// nothing while there is nothing to show (or while the feature is switched off for the
// creator), so an OBS source can stay in the scene.
export function SupporterOverlay({ token, kind }: { token: string; kind: SupporterKind }) {
  const { ref, w, portrait } = useStageSize();
  const [data, setData] = useState<Data>({});
  // The streak countdown ticks here every second; the server only sends the seconds left.
  const [left, setLeft] = useState(0);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      let wait = POLL_MS;
      try {
        const res = await fetch(`/api/overlay/${token}/supporters`, { cache: "no-store" });
        if (res.status === 404) {
          wait = GONE_POLL_MS;
          if (!stop) {
            setData({});
            setLeft(0);
          }
        } else if (!stop && res.ok) {
          const next = (await res.json()) as Data;
          setData(next);
          setLeft(next.streak?.remainingSeconds ?? 0);
        }
      } catch {
        // Keep what is on screen through a network blip.
      }
      if (!stop) timer = setTimeout(poll, wait);
    }
    poll();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [token]);

  useEffect(() => {
    if (kind !== "streak") return;
    const tick = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(tick);
  }, [kind]);

  return (
    <div ref={ref} className={`ov-stage${portrait ? " ov-portrait" : ""}`} style={stageStyle(w, portrait)}>
      <style>{STAGE_CSS + PANEL_CSS + CSS}</style>
      <Card kind={kind} data={data} left={left} />
    </div>
  );
}

function Card({ kind, data, left }: { kind: SupporterKind; data: Data; left: number }) {
  if (kind === "streak") {
    const streak = data.streak;
    if (!streak || streak.count === 0 || left <= 0) return null;
    const pct = Math.min(100, (left / streak.windowSeconds) * 100);
    const mm = Math.floor(left / 60);
    const ss = String(left % 60).padStart(2, "0");
    return (
      <div className="ov-dock ov-dock-tl">
        <div data-testid="support-streak" className="ov-panel ov-sup">
          <p className="ov-label">Support streak</p>
          <div className="ov-sup-line">
            <span className="ov-big ov-mono ov-money">
              <Bump value={streak.count}>{streak.count}</Bump>
            </span>
            <span className="ov-sup-text">
              {streak.count === 1 ? "tip" : "tips"} · <span style={{ fontVariantNumeric: "tabular-nums" }}>{mm}:{ss}</span> left
            </span>
          </div>
          <div className="ov-track" style={{ marginTop: "calc(var(--f) * 1.1)" }}>
            <div className="ov-fill ov-fill-live" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    );
  }

  if (kind === "top") {
    if (!data.top) return null;
    return (
      <div className="ov-dock ov-dock-tl">
        <div data-testid="top-supporter" className="ov-panel ov-sup">
          <p className="ov-label">Top supporter</p>
          <div className="ov-row ov-sup-row">
            <span className="ov-clip">{data.top.name}</span>
            <span className="ov-mono ov-money">
              <Bump value={data.top.totalPaise}>₹{rupees(data.top.totalPaise)}</Bump>
            </span>
          </div>
        </div>
      </div>
    );
  }

  const recent = data.recent ?? [];
  if (recent.length === 0) return null;
  const newest = `${recent[0].name}|${recent[0].amountPaise}`;
  return (
    <div className="ov-dock ov-dock-tl">
      <div data-testid="recent-supporters" className="ov-panel ov-sup ov-sup-recent">
        <p className="ov-label">Recent supporters</p>
        <ol className="ov-list">
          {recent.map((r, i) => (
            <li key={i} className="ov-row ov-sup-row ov-sup-item">
              <span className="ov-clip">{r.name}</span>
              <span className="ov-mono ov-money">
                {i === 0 ? <Bump value={newest}>₹{rupees(r.amountPaise)}</Bump> : <>₹{rupees(r.amountPaise)}</>}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

const CSS = `
.ov-sup { min-width: calc(var(--f) * 18); max-width: 100%; }
.ov-sup-recent { min-width: calc(var(--f) * 22); }
.ov-sup-line { display: flex; align-items: baseline; gap: calc(var(--f) * 1.2); margin-top: calc(var(--f) * 0.4); }
.ov-big { font-size: calc(var(--f) * 4.2); line-height: 1; letter-spacing: -0.025em; }
.ov-sup-text { font-size: calc(var(--f) * 1.7); font-weight: 600; }
.ov-sup-row { margin-top: calc(var(--f) * 0.4); font-size: calc(var(--f) * 2); font-weight: 600; }
.ov-list { list-style: none; margin: calc(var(--f) * 0.5) 0 0; padding: 0; display: grid; gap: calc(var(--f) * 0.3); }
.ov-sup-item { margin-top: 0; font-size: calc(var(--f) * 1.7); gap: calc(var(--f) * 2); }
`;
