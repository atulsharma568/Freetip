"use client";

import { useEffect, useRef, useState } from "react";

export interface OverlayAlert {
  id: number;
  kind: "alert" | "message";
  name: string;
  amountPaise: number;
  message: string | null;
  // The server will read the message aloud (live overlay only).
  speech?: boolean;
  // The creator's alert sound (live overlay only): played before the voice.
  sound?: { url: string; volume: number; ms: number } | null;
}

// An alert in the queue, with its speech already downloaded so the voice starts
// with the card instead of after a wait.
interface QueuedAlert extends OverlayAlert {
  audio?: HTMLAudioElement;
  speechMs?: number;
  clip?: HTMLAudioElement;
}

const POLL_MS = 4000;
const BASE_SHOW_MS = 6000;
const PER_CHAR_MS = 70;
const MAX_EXTRA_MS = 8000;
// Keep the card up a moment after the voice finishes.
const SPEECH_TAIL_MS = 1500;

function showMs(a: QueuedAlert) {
  const byLength = BASE_SHOW_MS + Math.min((a.message?.length ?? 0) * PER_CHAR_MS, MAX_EXTRA_MS);
  // The sound plays first and the voice follows it, so the card stays for both.
  const soundMs = a.clip && a.sound ? a.sound.ms : 0;
  return a.speechMs ? Math.max(byLength, soundMs + a.speechMs + SPEECH_TAIL_MS) : Math.max(byLength, soundMs + SPEECH_TAIL_MS);
}

// Downloads the speech for an alert. Any failure (speech off, engine down, slow
// network) returns null and the alert simply plays silently.
async function loadSpeech(
  token: string,
  id: number,
): Promise<{ audio: HTMLAudioElement; ms: number } | null> {
  try {
    const res = await fetch(`/api/overlay/${token}/speech/${id}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (res.status !== 200) return null;
    const url = URL.createObjectURL(await res.blob());
    const audio = new Audio(url);
    audio.preload = "auto";
    const seconds = await new Promise<number>((resolve) => {
      audio.addEventListener("loadedmetadata", () => resolve(audio.duration), { once: true });
      audio.addEventListener("error", () => resolve(NaN), { once: true });
      setTimeout(() => resolve(NaN), 3000);
    });
    if (!Number.isFinite(seconds) || seconds <= 0) {
      URL.revokeObjectURL(url);
      return null;
    }
    return { audio, ms: Math.ceil(seconds * 1000) };
  } catch {
    return null;
  }
}

function releaseSpeech(a: QueuedAlert) {
  a.clip?.pause();
  if (!a.audio) return;
  a.audio.pause();
  URL.revokeObjectURL(a.audio.src);
}

// The sound is a plain file on a public URL, so it loads as an ordinary audio
// element. A broken file or slow network never holds up the alert.
function loadClip(sound: { url: string; volume: number }): HTMLAudioElement | undefined {
  try {
    const clip = new Audio(sound.url);
    clip.preload = "auto";
    clip.volume = Math.min(1, Math.max(0.1, sound.volume / 100));
    return clip;
  } catch {
    return undefined;
  }
}

// Tells the server the card is on screen, so it counts as shown. Until then the
// server only holds the alert on a lease and would hand it out again after an OBS
// reload. A failed confirm is tried once more; if both fail the lease runs out and
// the alert may show twice, which beats losing it.
async function confirmShown(token: string, alert: { id: number; kind: "alert" | "message" }) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`/api/overlay/${token}/ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: alert.id, kind: alert.kind }),
        cache: "no-store",
        keepalive: true,
      });
      if (res.status < 500) return;
    } catch {
      // Network blip: try once more.
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

function rupees(paise: number) {
  const value = paise / 100;
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

// Live: pass `token` and it polls /api/overlay/<token>.
// Preview: pass `samples` and it replays them. Neither touches the database.
//
// Sizes come from one unit, --u = 1% of the stage width, set from the stage's
// own measured size. That makes the same markup right at 1920x1080, 2560x1440
// and 1080x1920 (and in the dashboard preview box) without viewport or
// container units, which older OBS browsers may not support. A stage taller
// than it is wide switches to the stacked vertical layout.
export function AlertStage({ token, samples }: { token?: string; samples?: OverlayAlert[] }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1920, h: 1080 });
  const [current, setCurrent] = useState<QueuedAlert | null>(null);
  const [invalid, setInvalid] = useState(false);
  const queue = useRef<QueuedAlert[]>([]);
  const seen = useRef(0);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth || 1920, h: el.clientHeight || 1080 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Source of alerts.
  useEffect(() => {
    if (samples) {
      const push = () => {
        queue.current.push({ ...samples[seen.current % samples.length], id: seen.current });
        seen.current += 1;
      };
      push();
      const t = setInterval(push, 9000);
      return () => clearInterval(t);
    }
    if (!token) return;
    let stopped = false;
    let polling = false;
    const poll = async () => {
      // Hold at most one alert in the queue (plus the one on screen): the server
      // leases what it hands out, so taking more than the stage can show soon would
      // let the leases run out.
      if (polling || queue.current.length > 0) return;
      polling = true;
      try {
        const res = await fetch(`/api/overlay/${token}`, { cache: "no-store" });
        if (res.status === 404) {
          setInvalid(true);
          stopped = true;
          return;
        }
        if (!res.ok) return;
        const body = (await res.json()) as { alert: OverlayAlert | null };
        if (body.alert) {
          const alert: QueuedAlert = body.alert;
          if (alert.sound) alert.clip = loadClip(alert.sound);
          if (alert.speech) {
            const speech = await loadSpeech(token, alert.id);
            if (speech) {
              alert.audio = speech.audio;
              alert.speechMs = speech.ms;
            }
          }
          queue.current.push(alert);
        }
      } catch {
        // Network blip: try again on the next tick.
      } finally {
        polling = false;
      }
    };
    poll();
    const t = setInterval(() => {
      if (!stopped) poll();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [token, samples]);

  // Play one alert at a time.
  useEffect(() => {
    if (current) {
      // The card is up: confirm it (live overlay only; the preview has no token).
      if (token) void confirmShown(token, current);
      // Start the voice with the card. A normal browser tab blocks sound until
      // someone clicks; OBS's browser source allows it, so a refused play is
      // simply silent.
      // The sound plays first and the voice starts when it ends. If the sound
      // cannot play (blocked, broken file) the voice starts at once; a timer
      // covers a clip that never reports its end.
      const { audio, clip, sound } = current;
      let started = false;
      const startVoice = () => {
        if (started) return;
        started = true;
        audio?.play().catch(() => {});
      };
      let fallback: ReturnType<typeof setTimeout> | undefined;
      if (clip && sound) {
        clip.addEventListener("ended", startVoice, { once: true });
        clip.addEventListener("error", startVoice, { once: true });
        fallback = setTimeout(startVoice, sound.ms + 500);
        clip.play().catch(startVoice);
      } else {
        startVoice();
      }
      const t = setTimeout(() => {
        releaseSpeech(current);
        setCurrent(null);
      }, showMs(current));
      return () => {
        clearTimeout(t);
        clearTimeout(fallback);
      };
    }
    const t = setInterval(() => {
      const next = queue.current.shift();
      if (next) setCurrent(next);
    }, 400);
    return () => clearInterval(t);
  }, [current, token]);

  const portrait = size.h > size.w;

  return (
    <div
      ref={stageRef}
      className={`ov-stage${portrait ? " ov-portrait" : ""}`}
      style={{ "--u": `${size.w / 100}px` } as React.CSSProperties}
    >
      <style>{CSS}</style>
      {invalid && (
        <p className="ov-invalid">This overlay link is no longer valid. Create a new one in your dashboard.</p>
      )}
      {current && (
        <div
          key={`${current.id}-${current.kind}`}
          className="ov-card"
          style={{ "--dur": `${showMs(current)}ms` } as React.CSSProperties}
          role="status"
        >
          <p className="ov-line">
            <span className="ov-name">{current.name}</span>
            {current.kind === "alert" && (
              <span className="ov-amount">₹{rupees(current.amountPaise)}</span>
            )}
          </p>
          {current.message && <p className="ov-message">{current.message}</p>}
        </div>
      )}
    </div>
  );
}

const CSS = `
.ov-stage { position: relative; width: 100%; height: 100%; overflow: hidden; font-family: var(--font-bricolage), system-ui, sans-serif; }
.ov-card {
  position: absolute; left: 50%; bottom: calc(var(--u) * 6);
  width: calc(var(--u) * 36); padding: calc(var(--u) * 1.6) calc(var(--u) * 2);
  background: #12130e; color: #f2f3ec; border-left: calc(var(--u) * 0.45) solid #bfe84a;
  border-radius: calc(var(--u) * 1); overflow-wrap: anywhere;
  transform: translateX(-50%);
  animation: ov-in 450ms cubic-bezier(.2,.8,.2,1) both, ov-out 400ms ease-in calc(var(--dur) - 400ms) forwards;
}
.ov-line { margin: 0; display: flex; align-items: baseline; justify-content: space-between; gap: calc(var(--u) * 1.5); }
.ov-name { font-size: calc(var(--u) * 1.8); font-weight: 600; }
.ov-amount { font-size: calc(var(--u) * 3.2); font-weight: 700; color: #bfe84a; white-space: nowrap; }
.ov-message { margin: calc(var(--u) * 0.8) 0 0; font-size: calc(var(--u) * 1.8); line-height: 1.3; color: #c9cbbd; }
.ov-portrait .ov-card { width: calc(var(--u) * 90); bottom: calc(var(--u) * 14); padding: calc(var(--u) * 4) calc(var(--u) * 5); border-left-width: calc(var(--u) * 1.2); border-radius: calc(var(--u) * 3); }
.ov-portrait .ov-name { font-size: calc(var(--u) * 5.2); }
.ov-portrait .ov-amount { font-size: calc(var(--u) * 9); }
.ov-portrait .ov-message { font-size: calc(var(--u) * 5); margin-top: calc(var(--u) * 2.4); }
.ov-invalid { position: absolute; inset: auto 0 0 0; margin: 0; padding: 12px; font-size: 14px; color: #f2f3ec; background: #12130e; }
@keyframes ov-in { from { opacity: 0; transform: translate(-50%, 40px); } to { opacity: 1; transform: translate(-50%, 0); } }
@keyframes ov-out { to { opacity: 0; transform: translate(-50%, 20px); } }
@media (prefers-reduced-motion: reduce) {
  .ov-card { animation: ov-fade 200ms both, ov-fade-out 200ms linear calc(var(--dur) - 200ms) forwards; }
  @keyframes ov-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes ov-fade-out { to { opacity: 0; } }
}
`;
