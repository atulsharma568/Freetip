"use client";

import { useEffect, useState } from "react";
import type { MeterReading } from "@/lib/page-doc/pressure";
import { Bump, PANEL_CSS } from "./panel";
import { STAGE_CSS, stageStyle, useStageSize } from "./stage";

interface Settings {
  heading: string;
  fill: string | null;
  celebrate: boolean;
  show: "rupees" | "percent";
  // The emblem's file address, or null.
  picture: string | null;
}

const POLL_MS = 5000;
// After a 404 (link replaced, meter off, hidden or set for the tip page only) ask once a
// minute, so a dead link in OBS does not hammer the server, yet a meter the owner turns on later
// shows up without a reload.
const GONE_POLL_MS = 60000;
// How long the card stays flipped to the accent after the goal is reached.
const REACHED_MS = 6000;

const rupees = (paise: number) => Math.floor(paise / 100).toLocaleString("en-IN");

// Polls /api/overlay/<token>/pressure and draws the creator's goal as a bar with its rank word.
// Draws nothing while there is no reading, so the OBS source can stay in the scene.
export function PressureBar({ token }: { token: string }) {
  const { ref, w, portrait } = useStageSize();
  const [state, setState] = useState<{ meter: MeterReading; settings: Settings } | null>(null);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      let wait = POLL_MS;
      try {
        const res = await fetch(`/api/overlay/${token}/pressure`, { cache: "no-store" });
        if (res.status === 404) {
          wait = GONE_POLL_MS;
          if (!stop) setState(null);
        } else if (!stop && res.ok) {
          const body = (await res.json()) as { meter: MeterReading | null; settings: Settings };
          setState(body.meter ? { meter: body.meter, settings: body.settings } : null);
        }
      } catch {
        // Keep the last bar on a network blip.
      }
      if (!stop) timer = setTimeout(poll, wait);
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
      {state && (
        <div className="ov-dock ov-dock-bc">
          <Meter meter={state.meter} settings={state.settings} />
        </div>
      )}
    </div>
  );
}

function Meter({ meter, settings }: { meter: MeterReading; settings: Settings }) {
  const { percent } = meter;
  // One-off flash: only when this overlay watches the bar cross the line, never when it loads
  // with the goal already met.
  const [prevPercent, setPrevPercent] = useState(percent);
  const [reached, setReached] = useState(false);
  if (prevPercent !== percent) {
    setPrevPercent(percent);
    if (prevPercent < 100 && percent >= 100 && settings.celebrate) setReached(true);
  }
  useEffect(() => {
    if (!reached) return;
    const t = setTimeout(() => setReached(false), REACHED_MS);
    return () => clearTimeout(t);
  }, [reached]);

  const heading = settings.heading || "Pressure";
  const label = meter.period ? `${heading} · ${meter.period}` : heading;
  const money = meter.raisedPaise !== undefined && meter.targetPaise !== undefined;

  return (
    <div data-testid="pressure-meter" className={`ov-panel ov-meter${reached ? " ov-reached" : ""}`}>
      <div className="ov-row ov-meter-top">
        <span className="ov-label ov-clip">
          {settings.picture && (
            // eslint-disable-next-line @next/next/no-img-element -- the owner's own upload, kept animated and unoptimised
            <img src={settings.picture} alt="" className="ov-emblem" onError={(e) => (e.currentTarget.style.display = "none")} />
          )}
          {label}
        </span>
        {reached && <span className="ov-reach ov-mono">GOAL REACHED</span>}
        <span className="ov-mono ov-meter-percent">
          <Bump value={percent}>{percent}%</Bump>
        </span>
      </div>
      <div
        className="ov-track"
        role="progressbar"
        aria-label={`${heading}: ${meter.title}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        style={{ marginTop: "calc(var(--f) * 1)" }}
      >
        <div className="ov-fill" style={{ width: `${percent}%`, ...(settings.fill && !reached ? { background: settings.fill } : {}) }} />
      </div>
      <div className="ov-row ov-meter-bottom">
        <span className="ov-clip">
          <strong>{meter.word}</strong>
          <span className="ov-meter-title"> · {meter.title}</span>
        </span>
        {money && (
          <span className="ov-mono ov-meter-sums">
            ₹{rupees(meter.raisedPaise!)} / ₹{rupees(meter.targetPaise!)}
          </span>
        )}
      </div>
      {meter.carryPaise ? <p className="ov-carry">includes ₹{rupees(meter.carryPaise)} carried over</p> : null}
    </div>
  );
}

const CSS = `
.ov-meter-top { font-size: calc(var(--f) * 1.8); font-weight: 600; }
.ov-emblem { width: calc(var(--f) * 2.4); height: calc(var(--f) * 2.4); margin-right: calc(var(--f) * 0.8); border-radius: calc(var(--f) * 0.4); object-fit: cover; vertical-align: middle; }
.ov-meter-percent { white-space: nowrap; }
.ov-meter-bottom { margin-top: calc(var(--f) * 0.9); font-size: calc(var(--f) * 1.6); }
.ov-meter-title { color: var(--ov-ash); font-weight: 400; }
.ov-meter-sums { white-space: nowrap; color: var(--ov-ash); }
.ov-reach { margin: 0 auto 0 calc(var(--f) * 1); padding: calc(var(--f) * 0.2) calc(var(--f) * 0.8); border-radius: 9999px; background: var(--ov-on-lime); color: var(--ov-lime); font-size: calc(var(--f) * 1.05); font-weight: 600; letter-spacing: 0.1em; white-space: nowrap; }
.ov-carry { margin: calc(var(--f) * 0.7) 0 0; font-size: calc(var(--f) * 1.3); color: var(--ov-ash); }
.ov-reached { background: var(--ov-lime); color: var(--ov-on-lime); }
.ov-reached .ov-label, .ov-reached .ov-meter-title, .ov-reached .ov-meter-sums, .ov-reached .ov-carry { color: var(--ov-on-lime); }
.ov-reached .ov-track { background: transparent; border-color: var(--ov-on-lime); }
.ov-reached .ov-fill { background: var(--ov-on-lime); }
`;
