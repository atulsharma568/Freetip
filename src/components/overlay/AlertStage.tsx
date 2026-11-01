"use client";

import { useEffect, useRef, useState } from "react";
import { tipTierLevel } from "@/lib/tip-tier";
import { wordTimings } from "./speech-words";
import { STAGE_CSS, useStageSize } from "./stage";

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
  // A made-up alert from the dashboard's test button: the card wears a TEST badge so
  // it is never mistaken for a real tip.
  test?: boolean;
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
// Sizes come from one unit, --u = 1% of the stage width (see stage.ts), so the same
// markup is right at 1920x1080, 2560x1440 and 1080x1920 (and in the dashboard
// preview box). A stage taller than it is wide switches to the stacked vertical
// layout. The card is the landing page's alert: a full lime field with ink text, the
// amount in mono, and it grows with the tip (tip-tier.ts thresholds).
export function AlertStage({ token, samples }: { token?: string; samples?: OverlayAlert[] }) {
  const { ref: stageRef, w: stageW, portrait } = useStageSize();
  const [current, setCurrent] = useState<QueuedAlert | null>(null);
  const [invalid, setInvalid] = useState(false);
  const queue = useRef<QueuedAlert[]>([]);
  const seen = useRef(0);
  // Dashboard commands: the first times the overlay saw, then only newer ones act.
  const controlsSeen = useRef<{ skipAt: number; testAt: number } | null>(null);
  const testCount = useRef(0);
  const currentRef = useRef<QueuedAlert | null>(null);
  const skipNow = useRef<() => void>(() => {});

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  // Skip: clear the card on screen and drop what waits. A waiting alert was leased
  // and never shown, so it is confirmed as handled, else it would come back when
  // its lease runs out.
  useEffect(() => {
    skipNow.current = () => {
      for (const a of queue.current) {
        releaseSpeech(a);
        if (token && a.id >= 0) void confirmShown(token, a);
      }
      queue.current = [];
      const c = currentRef.current;
      if (c) {
        releaseSpeech(c);
        setCurrent(null);
      }
    };
  }, [token]);

  // Source of alerts.
  useEffect(() => {
    if (samples) {
      const push = () => {
        const sample = samples[seen.current % samples.length];
        // No voice in a preview: pretend one, so the word highlight can be seen.
        const speechMs = sample.message ? sample.message.split(/\s+/).length * 380 : undefined;
        queue.current.push({ ...sample, id: seen.current, speechMs });
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
        const body = (await res.json()) as {
          alert: OverlayAlert | null;
          controls?: { skipAt: number; testAt: number };
        };
        const c = body.controls;
        if (c) {
          const was = controlsSeen.current;
          if (!was) {
            controlsSeen.current = { ...c };
          } else {
            if (c.skipAt > was.skipAt) {
              was.skipAt = c.skipAt;
              skipNow.current();
            }
            if (c.testAt > was.testAt) {
              was.testAt = c.testAt;
              testCount.current += 1;
              // A made-up alert: negative id, nothing to confirm or speak.
              queue.current.push({
                id: -testCount.current,
                kind: "alert",
                name: "Test alert",
                amountPaise: 4900,
                message: "This is a test from your dashboard.",
                test: true,
              });
            }
          }
        }
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
      if (token && current.id >= 0) void confirmShown(token, current);
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

  return (
    <div
      ref={stageRef}
      className={`ov-stage${portrait ? " ov-portrait" : ""}`}
      style={{ "--u": `${stageW / 100}px` } as React.CSSProperties}
    >
      <style>{STAGE_CSS + CSS}</style>
      {invalid && (
        <p className="ov-invalid">This overlay link is no longer valid. Create a new one in your dashboard.</p>
      )}
      {current && <Card key={`${current.id}-${current.kind}`} alert={current} />}
    </div>
  );
}

function Card({ alert }: { alert: QueuedAlert }) {
  const isAlert = alert.kind === "alert";
  const amount = rupees(alert.amountPaise);
  const level = tipTierLevel(alert.amountPaise / 100);
  // The sound plays first and the voice follows it, so the words start after it.
  const leadMs = alert.clip && alert.sound ? alert.sound.ms : 0;
  const timings = alert.message && alert.speechMs ? wordTimings(alert.message, alert.speechMs, leadMs) : null;
  const name = alert.name || "Anonymous";

  return (
    <div
      className={`ov-card ov-t${level}`}
      style={
        {
          "--dur": `${showMs(alert)}ms`,
          // Long amounts shrink a little so they never wrap or overflow the card.
          "--fit": Math.min(1, 7 / (amount.length + 1)),
        } as React.CSSProperties
      }
      data-test={alert.test ? "true" : undefined}
      role="status"
    >
      <p className="ov-top">
        <span className="ov-name">
          {name}
          {!alert.test && <span className="ov-verb">{isAlert ? " tipped" : " says"}</span>}
        </span>
        {alert.test && <span className="ov-test">TEST</span>}
      </p>
      {isAlert && <p className="ov-amount ov-mono">₹{amount}</p>}
      {alert.message && (
        <p className="ov-message">
          {timings
            ? timings.map((t, i) => (
                <span key={i}>
                  {i > 0 && " "}
                  <span
                    className="ov-w"
                    style={{ "--ws": `${t.startMs}ms`, "--wd": `${t.durMs}ms` } as React.CSSProperties}
                  >
                    {t.word}
                  </span>
                </span>
              ))
            : alert.message}
        </p>
      )}
    </div>
  );
}

// Sizes are in --u. --s grows the landscape card with the tip, --sp the portrait one
// (portrait is narrower, so it grows less). Motion is a wipe from the top edge in and
// out, like the landing page's alert; reduced motion gets a plain fade. The lit word
// is an ink pill with accent text that switches on and off with no fade.
const CSS = `
.ov-card {
  --s: 1; --sp: 1; --fit: 1;
  position: absolute; left: 50%; bottom: calc(var(--u) * 6); transform: translateX(-50%);
  box-sizing: border-box; width: calc(var(--u) * 30 * var(--s)); max-width: 96%;
  padding: calc(var(--u) * 1.8 * var(--s)) calc(var(--u) * 2.2 * var(--s));
  background: var(--ov-lime); color: var(--ov-on-lime);
  border-radius: calc(var(--u) * 1.04); overflow-wrap: anywhere;
  animation: ov-wipe-in 600ms cubic-bezier(.16,1,.3,1) both, ov-wipe-out 450ms cubic-bezier(.7,0,.84,0) calc(var(--dur) - 450ms) forwards;
}
.ov-t1 { --s: 1.12; --sp: 1.05; }
.ov-t2 { --s: 1.25; --sp: 1.1; }
.ov-t3 { --s: 1.4; --sp: 1.16; }
.ov-top { margin: 0; display: flex; align-items: center; gap: calc(var(--u) * 1); font-size: calc(var(--u) * 1.8); font-weight: 600; line-height: 1.2; }
.ov-verb { font-weight: 500; }
.ov-test {
  margin-left: auto; padding: calc(var(--u) * 0.25) calc(var(--u) * 0.9); border-radius: 9999px;
  background: var(--ov-on-lime); color: var(--ov-lime);
  font-family: var(--font-geist-mono), ui-monospace, monospace; font-size: calc(var(--u) * 1.2); font-weight: 600; letter-spacing: 0.12em;
}
.ov-amount { margin: calc(var(--u) * 0.6) 0 0; font-size: calc(var(--u) * 5.4 * var(--s) * var(--fit)); font-weight: 600; line-height: 1; letter-spacing: -0.025em; white-space: nowrap; }
.ov-message { margin: calc(var(--u) * 1.3) 0 0; font-size: calc(var(--u) * 1.9); font-weight: 500; line-height: 1.35; word-spacing: 0.25em; }
.ov-w { display: inline-block; margin: 0 calc(var(--u) * -0.35); padding: calc(var(--u) * 0.08) calc(var(--u) * 0.35); border-radius: 9999px; animation: ov-word var(--wd) linear var(--ws) 1; }
.ov-portrait .ov-card { width: calc(var(--u) * 90); bottom: calc(var(--u) * 14); padding: calc(var(--u) * 4.5 * var(--sp)) calc(var(--u) * 5.5); border-radius: calc(var(--u) * 2.2); }
.ov-portrait .ov-top { font-size: calc(var(--u) * 4.6); gap: calc(var(--u) * 2); }
.ov-portrait .ov-test { font-size: calc(var(--u) * 3); padding: calc(var(--u) * 0.6) calc(var(--u) * 2.2); }
.ov-portrait .ov-amount { margin-top: calc(var(--u) * 1.4); font-size: calc(var(--u) * 13 * var(--sp) * var(--fit)); }
.ov-portrait .ov-message { margin-top: calc(var(--u) * 3); font-size: calc(var(--u) * 5); }
.ov-portrait .ov-w { margin: 0 calc(var(--u) * -0.8); padding: calc(var(--u) * 0.2) calc(var(--u) * 0.8); }
.ov-invalid {
  position: absolute; inset: auto 0 0 0; margin: 0; padding: calc(var(--u) * 1.2) calc(var(--u) * 2);
  font-size: calc(var(--u) * 1.7); font-weight: 500; line-height: 1.3; color: var(--ov-chalk); background: var(--ov-night);
}
.ov-portrait .ov-invalid { font-size: calc(var(--u) * 4.4); padding: calc(var(--u) * 3) calc(var(--u) * 5); }
@keyframes ov-wipe-in { from { clip-path: inset(0 0 100% 0); } to { clip-path: inset(0 0 0 0); } }
@keyframes ov-wipe-out { from { clip-path: inset(0 0 0 0); } to { clip-path: inset(100% 0 0 0); } }
@keyframes ov-word { from, to { background: var(--ov-on-lime); color: var(--ov-lime); } }
@media (prefers-reduced-motion: reduce) {
  .ov-card { animation: ov-fade 200ms both, ov-fade-out 200ms linear calc(var(--dur) - 200ms) forwards; }
}
@keyframes ov-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes ov-fade-out { to { opacity: 0; } }
`;
