"use client";

import { useEffect, useState } from "react";
import type { PinnedCard } from "@/lib/pinned";
import { Bump, PANEL_CSS } from "./panel";
import { STAGE_CSS, stageStyle, useStageSize } from "./stage";

const POLL_MS = 3000;
// After a 404 (link replaced, or the creator paused) ask only once a minute, so a dead link
// in OBS does not hammer the server, yet a creator who comes back shows up without a reload.
const GONE_POLL_MS = 60000;

const rupees = (paise: number) => Math.floor(paise / 100).toLocaleString("en-IN");

// The pinned message card. Polls /api/overlay/<token>/pinned and draws nothing while
// nothing is pinned (or the feature is off), so an OBS source can stay in the scene. The
// server sends the seconds left; the bar and the end of the card run from that here. An
// Unpin on the dashboard shows up on the next poll, a few seconds later. A network blip
// keeps the card on screen, but only until its own time runs out.
export function PinnedOverlay({ token }: { token: string }) {
  const { ref, w, portrait } = useStageSize();
  const [card, setCard] = useState<PinnedCard | null>(null);
  const [left, setLeft] = useState(0);
  // The pinned time the card started with, so the bar shrinks from full to empty
  // however many polls happen in between.
  const [total, setTotal] = useState({ id: 0, seconds: 1 });

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      let wait = POLL_MS;
      try {
        const res = await fetch(`/api/overlay/${token}/pinned`, { cache: "no-store" });
        if (res.status === 404) {
          wait = GONE_POLL_MS;
          if (!stop) {
            setCard(null);
            setLeft(0);
          }
        } else if (!stop && res.ok) {
          const next = (await res.json()) as { pinned: PinnedCard | null };
          setCard(next.pinned);
          setLeft(next.pinned?.secondsLeft ?? 0);
          const p = next.pinned;
          if (p) setTotal((t) => (t.id === p.id ? t : { id: p.id, seconds: Math.max(1, p.secondsLeft) }));
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
    const tick = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(tick);
  }, []);

  const show = card !== null && left > 0;

  return (
    <div ref={ref} className={`ov-stage${portrait ? " ov-portrait" : ""}`} style={stageStyle(w, portrait)}>
      <style>{STAGE_CSS + PANEL_CSS + CSS}</style>
      {show && (
        // Keyed by tip, so a newer message replaces the old card with a fresh entrance.
        <div key={card.id} className="ov-dock ov-dock-bc">
          <div data-testid="pinned-message" className="ov-panel ov-pin">
            <div className="ov-row">
              <span className="ov-label ov-clip">Pinned message</span>
              <span className="ov-mono ov-money">
                <Bump value={card.amountPaise}>₹{rupees(card.amountPaise)}</Bump>
              </span>
            </div>
            <p className="ov-pin-name ov-clip">{card.name}</p>
            <p data-testid="pinned-text" className="ov-pin-text">{card.message}</p>
            <div className="ov-track" style={{ marginTop: "calc(var(--f) * 1.1)" }}>
              <div
                className="ov-fill ov-fill-live"
                style={{ width: `${Math.min(100, (left / total.seconds) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
.ov-pin { width: 100%; }
.ov-pin-name { margin: calc(var(--f) * 0.5) 0 0; font-size: calc(var(--f) * 1.9); font-weight: 600; }
.ov-pin-text { margin: calc(var(--f) * 0.5) 0 0; font-size: calc(var(--f) * 2.3); line-height: 1.3; overflow-wrap: anywhere; }
`;
