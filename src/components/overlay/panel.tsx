"use client";

import { useState, type ReactNode } from "react";

// A number that bumps when its value changes (and stays still on first show). The
// key restarts the CSS keyframe each time.
export function Bump({ value, children }: { value: string | number; children: ReactNode }) {
  const [prev, setPrev] = useState(value);
  const [changes, setChanges] = useState(0);
  if (prev !== value) {
    setPrev(value);
    setChanges(changes + 1);
  }
  return (
    <span key={changes} className={changes > 0 ? "ov-num ov-bump" : "ov-num"}>
      {children}
    </span>
  );
}

// The look shared by the goal bar and the three supporter overlays: a flat Warm
// Night panel with the same 20px-at-1080p corner as the alert, Chalk text, mono
// numerals, the accent as text and fills only. No translucency, blur or shadow.
// Sizes are in --f (see stage.ts). Reduced motion: a plain fade, no bump, no sweep.
export const PANEL_CSS = `
.ov-dock { position: absolute; display: flex; flex-direction: column; gap: calc(var(--f) * 0.9); }
.ov-dock-tl { left: calc(var(--f) * 2.5); top: calc(var(--f) * 2.5); max-width: 94%; }
.ov-dock-bc { left: 50%; bottom: calc(var(--f) * 3); transform: translateX(-50%); width: calc(var(--f) * 50); max-width: 94%; }
.ov-panel {
  box-sizing: border-box; padding: calc(var(--f) * 1.4) calc(var(--f) * 1.8);
  background: var(--ov-night); color: var(--ov-chalk); border-radius: calc(var(--f) * 1.04);
  animation: ov-rise 500ms cubic-bezier(.16,1,.3,1) both;
}
.ov-label { margin: 0; font-size: calc(var(--f) * 1.05); font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ov-ash); }
.ov-row { display: flex; justify-content: space-between; align-items: baseline; gap: calc(var(--f) * 1.6); }
.ov-clip { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ov-money { color: var(--ov-lime); font-weight: 600; white-space: nowrap; }
.ov-num { display: inline-block; transform-origin: left bottom; }
.ov-bump { animation: ov-bump 450ms cubic-bezier(.16,1,.3,1); }
.ov-track { box-sizing: border-box; height: calc(var(--f) * 0.9); border: calc(var(--f) * 0.16) solid transparent; border-radius: 9999px; background: var(--ov-raised); overflow: hidden; }
.ov-fill { height: 100%; border-radius: 9999px; background: var(--ov-lime); transition: width 800ms cubic-bezier(.16,1,.3,1); animation: ov-sweep 900ms cubic-bezier(.16,1,.3,1) both; }
.ov-fill-live { transition-duration: 1s; transition-timing-function: linear; animation-duration: 600ms; }
@keyframes ov-rise { from { opacity: 0; transform: translateY(calc(var(--f) * 1.5)); } to { opacity: 1; transform: none; } }
@keyframes ov-bump { 0% { transform: scale(1); } 35% { transform: scale(1.18); } 100% { transform: scale(1); } }
@keyframes ov-sweep { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
@keyframes ov-fade-in { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .ov-panel { animation: ov-fade-in 200ms both; }
  .ov-bump, .ov-fill { animation: none; }
  .ov-fill { transition: none; }
}
`;
