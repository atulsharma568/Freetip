"use client";

import { useEffect, useRef, useState } from "react";
import { tipTierLevel } from "@/lib/tip-tier";
import { MEDIA_WEBM_MAX_MS, type AlertMedia } from "@/lib/media";
import { STAY_MAX_SECONDS } from "@/lib/alert-rules";
import { overlayStyleVars, type OverlayStyle } from "@/lib/overlay-themes";
import { alertTextVars, headlineSegments, type AlertText } from "@/lib/alert-text";
import { motionGapMs, motionStayMs, type AlertMotion } from "@/lib/alert-motion";
import { mixVolume, type AlertLayout } from "@/lib/alert-layout";
import { wordTimings } from "./speech-words";
import { STAGE_CSS, useStageSize } from "./stage";

export interface OverlayAlert {
  // Preview only: how long the card stays, in ms, instead of the normal length.
  previewMs?: number;
  id: number;
  kind: "alert" | "message";
  name: string;
  amountPaise: number;
  message: string | null;
  // The server will read the message aloud (live overlay only).
  speech?: boolean;
  // The creator's alert sound (live overlay only): played before the voice.
  sound?: { url: string; volume: number; ms: number } | null;
  // The creator's GIF, image or WebM for this alert (live overlay only).
  media?: AlertMedia | null;
  // How long this alert stays up, in ms (alert rules for big tips); missing is the normal length.
  stayMs?: number | null;
  // The creator's card style and font (overlay themes; live overlay and the dashboard
  // preview). Missing or null is the plain card.
  theme?: OverlayStyle | null;
  // The creator's headline, colours, text size and weight (alert text and colours; live
  // overlay and the dashboard preview). Missing or null is the normal card.
  text?: AlertText | null;
  // How the card comes and goes, how long it stays and the pause before the next alert
  // (alert animations and timing; live overlay and the dashboard preview). Missing or null
  // is the normal card.
  motion?: AlertMotion | null;
  // The creator's master volume for sounds and voice and the side the picture goes on
  // (alert volume and layout; live overlay and the dashboard preview). Missing or null is
  // the normal alert.
  layout?: AlertLayout | null;
  // The fan's level after this tip (fan levels); live overlay only.
  level?: { level: number; up: boolean } | null;
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
  // A dashboard preview leaves soon, so the way out can be seen without a long wait.
  if (a.previewMs) return a.previewMs;
  // The creator's own length replaces the usual 6 seconds plus reading time; what the sound,
  // voice and video need below still holds it up, so nothing is cut off.
  const byLength = motionStayMs(a.motion) ?? BASE_SHOW_MS + Math.min((a.message?.length ?? 0) * PER_CHAR_MS, MAX_EXTRA_MS);
  // The sound plays first and the voice follows it, so the card stays for both.
  const soundMs = a.clip && a.sound ? a.sound.ms : 0;
  // A WebM plays through (up to its hard cap) before the card leaves.
  const mediaMs = a.media?.kind === "webm" && a.media.durationMs ? Math.min(a.media.durationMs, MEDIA_WEBM_MAX_MS) + 500 : 0;
  const base = a.speechMs ? Math.max(byLength, soundMs + a.speechMs + SPEECH_TAIL_MS) : Math.max(byLength, soundMs + SPEECH_TAIL_MS);
  const normal = Math.max(base, mediaMs);
  // A rule's stay only lengthens the alert, and never past the cap.
  return a.stayMs ? Math.max(normal, Math.min(a.stayMs, STAY_MAX_SECONDS * 1000)) : normal;
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
function loadClip(sound: { url: string; volume: number }, master?: number): HTMLAudioElement | undefined {
  try {
    const clip = new Audio(sound.url);
    clip.preload = "auto";
    clip.volume = mixVolume(sound.volume / 100, master);
    return clip;
  } catch {
    return undefined;
  }
}

// Loads the creator's file ahead of the card, so it shows with the card instead of
// popping in late. Any failure (a missing file, a slow network, a format the browser
// cannot play) returns false and the alert plays as the plain card.
async function preloadMedia(media: AlertMedia): Promise<boolean> {
  const TIMEOUT_MS = 6000;
  try {
    if (media.kind === "webm") {
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      return await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), TIMEOUT_MS);
        const done = (ok: boolean) => {
          clearTimeout(timer);
          resolve(ok);
        };
        video.addEventListener("canplaythrough", () => done(true), { once: true });
        video.addEventListener("error", () => done(false), { once: true });
        video.src = media.url;
        video.load();
      });
    }
    const img = new Image();
    img.src = media.url;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        img.decode(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("slow")), TIMEOUT_MS);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
    return true;
  } catch {
    return false;
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
  // The next alert waits until this time (the creator's pause after a card leaves).
  const gapUntil = useRef(0);

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
          if (alert.sound) alert.clip = loadClip(alert.sound, alert.layout?.soundVolume);
          if (alert.media && !(await preloadMedia(alert.media))) alert.media = null;
          if (alert.speech) {
            const speech = await loadSpeech(token, alert.id);
            if (speech) {
              // The creator's master volume for the voice (only ever quieter than the voice itself).
              speech.audio.volume = mixVolume(1, alert.layout?.voiceVolume);
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
        gapUntil.current = Date.now() + motionGapMs(current.motion);
        setCurrent(null);
      }, showMs(current));
      return () => {
        clearTimeout(t);
        clearTimeout(fallback);
      };
    }
    const t = setInterval(() => {
      if (Date.now() < gapUntil.current) return;
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
      {current && <Scene key={`${current.id}-${current.kind}`} alert={current} />}
    </div>
  );
}

// The card, with the creator's file where they placed it: above the card, behind its
// text or filling the stage behind it. No file means the plain card.
function Scene({ alert }: { alert: QueuedAlert }) {
  const media = alert.media;
  if (!media) return <Card alert={alert} />;
  if (media.placement === "fullscreen") {
    return (
      <>
        <MediaLayer media={media} durMs={showMs(alert)} stays={!!alert.stayMs} />
        <Card alert={alert} />
      </>
    );
  }
  if (media.placement === "above") {
    const level = tipTierLevel(alert.amountPaise / 100);
    // The picture beside the card instead of above it (alert volume and layout); on a vertical
    // screen it stays above, so the card keeps its width (see the CSS).
    const side = alert.layout?.side;
    return (
      <div className={`ov-stack ov-t${level}${side ? ` ov-side ov-side-${side}` : ""}`}>
        <MediaLayer media={media} durMs={showMs(alert)} stays={!!alert.stayMs} />
        <Card alert={alert} />
      </div>
    );
  }
  return <Card alert={alert} behind={media} />;
}

// One file. It never makes sound (a tip uses a sound or the voice, and a clip's own
// audio would fight both), a WebM stops at its hard cap whatever the file says, and a
// file that fails to play just disappears and leaves the card.
function MediaLayer({ media, durMs, stays }: { media: AlertMedia; durMs: number; stays?: boolean }) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    // A video normally stops at its 10 s cap; under a rule's long stay it keeps looping.
    if (media.kind !== "webm" || stays) return;
    const t = setTimeout(() => setGone(true), MEDIA_WEBM_MAX_MS);
    return () => clearTimeout(t);
  }, [media, stays]);
  if (gone) return null;
  const className = `ov-media ov-media-${media.placement}`;
  const style = { "--dur": `${durMs}ms` } as React.CSSProperties;
  return media.kind === "webm" ? (
    <video className={className} style={style} src={media.url} autoPlay muted loop playsInline onError={() => setGone(true)} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- an OBS overlay, not a page: a plain element keeps the GIF animated and skips the image optimiser
    <img className={className} style={style} src={media.url} alt="" onError={() => setGone(true)} />
  );
}

function Card({ alert, behind }: { alert: QueuedAlert; behind?: AlertMedia }) {
  const isAlert = alert.kind === "alert";
  const amount = rupees(alert.amountPaise);
  const level = tipTierLevel(alert.amountPaise / 100);
  // The sound plays first and the voice follows it, so the words start after it.
  const leadMs = alert.clip && alert.sound ? alert.sound.ms : 0;
  const timings = alert.message && alert.speechMs ? wordTimings(alert.message, alert.speechMs, leadMs) : null;
  const name = alert.name || "Anonymous";
  // The creator's own headline ("{name} tipped {amount}") replaces "Name tipped" on the alert
  // card; with {amount} in it the big amount line is not shown twice. The message card keeps
  // "Name says".
  const segments = isAlert && alert.text?.headline ? headlineSegments(alert.text.headline) : null;
  const amountInHeadline = !!segments?.some((s) => s.kind === "amount");
  const themeVars = overlayStyleVars(alert.theme);

  return (
    <div
      className={`ov-card ov-t${level}`}
      style={
        {
          ...themeVars,
          ...alertTextVars(alert.text, Number(themeVars["--c-fs"] ?? 1)),
          "--dur": `${showMs(alert)}ms`,
          // Long amounts shrink a little so they never wrap or overflow the card.
          "--fit": Math.min(1, 7 / (amount.length + 1)),
        } as React.CSSProperties
      }
      data-test={alert.test ? "true" : undefined}
      data-in={alert.motion?.enter}
      data-out={alert.motion?.exit}
      role="status"
    >
      {behind && <MediaLayer media={behind} durMs={showMs(alert)} stays={!!alert.stayMs} />}
      <p className="ov-top">
        {segments ? (
          <span className="ov-name">
            {segments.map((seg, i) =>
              seg.kind === "name" ? (
                <span key={i}>{name}</span>
              ) : seg.kind === "amount" ? (
                <span key={i} className="ov-mono ov-inline-amount">
                  ₹{amount}
                </span>
              ) : (
                <span key={i} className="ov-verb">
                  {seg.text}
                </span>
              ),
            )}
          </span>
        ) : (
          <span className="ov-name">
            {name}
            {!alert.test && <span className="ov-verb">{isAlert ? " tipped" : " says"}</span>}
          </span>
        )}
        {isAlert && alert.level && (
          <span className="ov-level">{alert.level.up ? `Level up! Lv ${alert.level.level}` : `Lv ${alert.level.level}`}</span>
        )}
        {alert.test && <span className="ov-test">TEST</span>}
      </p>
      {isAlert && !amountInHeadline && <p className="ov-amount ov-mono">₹{amount}</p>}
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
  --s: 1; --sp: 1; --fit: 1; --c-fs: 1; --bleed: calc(var(--u) * 3);
  --c-bg: var(--ov-lime); --c-fg: var(--ov-on-lime); --c-amount: var(--c-fg);
  --c-word-bg: var(--ov-on-lime); --c-word-fg: var(--ov-lime);
  --c-tag-bg: var(--ov-on-lime); --c-tag-fg: var(--ov-lime);
  --c-radius: calc(var(--u) * 1.04); --c-radius-p: calc(var(--u) * 2.2);
  position: absolute; left: 50%; bottom: calc(var(--u) * 6); transform: translateX(-50%);
  box-sizing: border-box; width: calc(var(--u) * 30 * var(--s)); max-width: 96%;
  padding: calc(var(--u) * 1.8 * var(--s)) calc(var(--u) * 2.2 * var(--s));
  background: var(--c-bg); color: var(--c-fg); font-family: var(--c-font, inherit);
  border: var(--c-border, 0 solid transparent); box-shadow: var(--c-shadow, none);
  border-radius: var(--c-radius); overflow-wrap: anywhere;
  --in-name: ov-wipe-in; --in-ms: 600ms; --in-ease: cubic-bezier(.16,1,.3,1);
  --out-name: ov-wipe-out; --out-ms: 450ms; --out-ease: cubic-bezier(.7,0,.84,0);
  animation: var(--in-name) var(--in-ms) var(--in-ease) both, var(--out-name) var(--out-ms) var(--out-ease) calc(var(--dur) - var(--out-ms)) forwards;
}
.ov-card[data-in="fade"] { --in-name: ov-fade; --in-ms: 500ms; --in-ease: ease-out; }
.ov-card[data-in="slide"] { --in-name: ov-slide-in; --in-ms: 600ms; }
.ov-card[data-in="zoom"] { --in-name: ov-zoom-in; --in-ms: 500ms; }
.ov-card[data-in="bounce"] { --in-name: ov-bounce-in; --in-ms: 800ms; --in-ease: linear; }
.ov-card[data-out="fade"] { --out-name: ov-fade-out; --out-ms: 450ms; --out-ease: ease-in; }
.ov-card[data-out="slide"] { --out-name: ov-slide-out; --out-ms: 500ms; }
.ov-card[data-out="zoom"] { --out-name: ov-zoom-out; --out-ms: 450ms; --out-ease: ease-in; }
.ov-t1 { --s: 1.12; --sp: 1.05; }
.ov-t2 { --s: 1.25; --sp: 1.1; }
.ov-t3 { --s: 1.4; --sp: 1.16; }
.ov-top { margin: 0; display: flex; align-items: center; gap: calc(var(--u) * 1); font-size: calc(var(--u) * 1.8 * var(--c-fs)); font-weight: var(--c-fw-top, 600); line-height: 1.2; }
.ov-verb { font-weight: var(--c-fw-verb, 500); }
.ov-inline-amount { font-weight: 700; }
.ov-level {
  margin-left: auto; padding: calc(var(--u) * 0.25) calc(var(--u) * 0.9); border-radius: 9999px; white-space: nowrap;
  background: var(--c-tag-bg); color: var(--c-tag-fg);
  font-family: var(--font-geist-mono), ui-monospace, monospace; font-size: calc(var(--u) * 1.3); font-weight: 600; letter-spacing: 0.06em;
}
.ov-portrait .ov-level { font-size: calc(var(--u) * 3.2); padding: calc(var(--u) * 0.5) calc(var(--u) * 1.8); }
.ov-portrait .ov-test {
  margin-left: auto; padding: calc(var(--u) * 0.25) calc(var(--u) * 0.9); border-radius: 9999px;
  background: var(--c-tag-bg); color: var(--c-tag-fg);
  font-family: var(--font-geist-mono), ui-monospace, monospace; font-size: calc(var(--u) * 1.2); font-weight: 600; letter-spacing: 0.12em;
}
.ov-amount { margin: calc(var(--u) * 0.6) 0 0; color: var(--c-amount); font-size: calc(var(--u) * 5.4 * var(--s) * var(--fit)); font-weight: 600; line-height: 1; letter-spacing: -0.025em; white-space: nowrap; }
.ov-message { margin: calc(var(--u) * 1.3) 0 0; font-size: calc(var(--u) * 1.9 * var(--c-fs)); font-weight: var(--c-fw-msg, 500); line-height: 1.35; word-spacing: 0.25em; }
.ov-w { display: inline-block; margin: 0 calc(var(--u) * -0.35); padding: calc(var(--u) * 0.08) calc(var(--u) * 0.35); border-radius: 9999px; animation: ov-word var(--wd) linear var(--ws) 1; }
.ov-portrait .ov-card { width: calc(var(--u) * 90); bottom: calc(var(--u) * 14); padding: calc(var(--u) * 4.5 * var(--sp)) calc(var(--u) * 5.5); border-radius: var(--c-radius-p); }
.ov-portrait .ov-top { font-size: calc(var(--u) * 4.6 * var(--c-fs)); gap: calc(var(--u) * 2); }
.ov-portrait .ov-test { font-size: calc(var(--u) * 3); padding: calc(var(--u) * 0.6) calc(var(--u) * 2.2); }
.ov-portrait .ov-amount { margin-top: calc(var(--u) * 1.4); font-size: calc(var(--u) * 13 * var(--sp) * var(--fit)); }
.ov-portrait .ov-message { margin-top: calc(var(--u) * 3); font-size: calc(var(--u) * 5 * var(--c-fs)); }
.ov-portrait .ov-w { margin: 0 calc(var(--u) * -0.8); padding: calc(var(--u) * 0.2) calc(var(--u) * 0.8); }
.ov-card > :not(.ov-media) { position: relative; z-index: 1; }
.ov-media { --mo: 1; pointer-events: none; animation: ov-media-in 400ms ease both, ov-media-out 450ms ease calc(var(--dur) - 450ms) forwards; }
.ov-media-behind { --mo: 0.3; position: absolute; inset: 0; z-index: 0; width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
.ov-media-fullscreen { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
.ov-media-above { display: block; max-width: 100%; max-height: calc(var(--u) * 20); object-fit: contain; }
.ov-stack {
  position: absolute; left: 50%; bottom: calc(var(--u) * 6); transform: translateX(-50%);
  box-sizing: border-box; width: calc(var(--u) * 30 * var(--s, 1)); max-width: 96%;
  display: flex; flex-direction: column; align-items: center; gap: calc(var(--u) * 1.4);
}
.ov-stack .ov-card { position: relative; left: auto; bottom: auto; transform: none; width: 100%; max-width: none; }
.ov-stage:not(.ov-portrait) .ov-stack.ov-side { flex-direction: row; align-items: center; width: max-content; gap: calc(var(--u) * 1.6); }
.ov-stage:not(.ov-portrait) .ov-stack.ov-side-right { flex-direction: row-reverse; }
.ov-stage:not(.ov-portrait) .ov-stack.ov-side .ov-card { width: calc(var(--u) * 30 * var(--s, 1)); flex: none; }
.ov-stage:not(.ov-portrait) .ov-stack.ov-side .ov-media-above { max-width: calc(var(--u) * 20); max-height: calc(var(--u) * 20); flex: none; }
.ov-portrait .ov-stack { width: calc(var(--u) * 90); bottom: calc(var(--u) * 14); gap: calc(var(--u) * 3); }
.ov-portrait .ov-stack .ov-card { width: 100%; }
.ov-portrait .ov-media-above { max-height: calc(var(--u) * 45); }
.ov-invalid {
  position: absolute; inset: auto 0 0 0; margin: 0; padding: calc(var(--u) * 1.2) calc(var(--u) * 2);
  font-size: calc(var(--u) * 1.7); font-weight: 500; line-height: 1.3; color: var(--ov-chalk); background: var(--ov-night);
}
.ov-portrait .ov-invalid { font-size: calc(var(--u) * 4.4); padding: calc(var(--u) * 3) calc(var(--u) * 5); }
@keyframes ov-wipe-in { from { clip-path: inset(calc(var(--bleed) * -1) calc(var(--bleed) * -1) 100% calc(var(--bleed) * -1)); } to { clip-path: inset(calc(var(--bleed) * -1)); } }
@keyframes ov-wipe-out { from { clip-path: inset(calc(var(--bleed) * -1)); } to { clip-path: inset(100% calc(var(--bleed) * -1) calc(var(--bleed) * -1) calc(var(--bleed) * -1)); } }
@keyframes ov-slide-in { from { opacity: 0; translate: 0 calc(var(--u) * 10); } to { opacity: 1; translate: 0 0; } }
@keyframes ov-slide-out { from { opacity: 1; translate: 0 0; } to { opacity: 0; translate: 0 calc(var(--u) * 10); } }
@keyframes ov-zoom-in { from { opacity: 0; scale: 0.6; } to { opacity: 1; scale: 1; } }
@keyframes ov-zoom-out { from { opacity: 1; scale: 1; } to { opacity: 0; scale: 0.6; } }
@keyframes ov-bounce-in { 0% { opacity: 0; scale: 0.3; } 40% { opacity: 1; scale: 1.1; } 65% { scale: 0.94; } 85% { scale: 1.03; } 100% { opacity: 1; scale: 1; } }
@keyframes ov-media-in { from { opacity: 0; } to { opacity: var(--mo); } }
@keyframes ov-media-out { from { opacity: var(--mo); } to { opacity: 0; } }
@keyframes ov-word { from, to { background: var(--c-word-bg); color: var(--c-word-fg); } }
@media (prefers-reduced-motion: reduce) {
  .ov-card { animation: ov-fade 200ms both, ov-fade-out 200ms linear calc(var(--dur) - 200ms) forwards; }
}
@keyframes ov-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes ov-fade-out { to { opacity: 0; } }
`;
