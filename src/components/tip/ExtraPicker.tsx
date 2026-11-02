"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { FilmSlate, MusicNote, Pause, Play, Sparkle, SpeakerHigh, Timer } from "@phosphor-icons/react";
import type { TipRule, TipSound } from "@/app/[handle]/creator";
import { useWheelScroll } from "@/components/ui/useWheelScroll";
import { useAudioPreview } from "@/components/ui/useAudioPreview";
import { FieldNote } from "./FieldNote";

// What the alert adds besides the card. Three separate sections on the tip page:
//   1. the streamer's choice (their default sound) or the message read aloud,
//   2. the soundboard (swipe sideways for more),
//   3. the creator's picks: a GIF with its sound at a fixed amount (swipe sideways).
// It is still one choice, so a tip never has two of them: a pick plays on its own with no
// message, a sound never comes with the voice. A sound or the voice above the tip amount is
// locked and says what it takes to unlock it. The server checks the pick again.
export type Extra =
  | { kind: "default" }
  | { kind: "sound"; id: number }
  | { kind: "voice" }
  | { kind: "rule"; id: number };

const rupeesOf = (paise: number) => Math.ceil(paise / 100);

// Arrow keys move through the options of one section like a native radio group: one tab
// stop for the group, the arrows (and Home and End) move focus and pick. A locked option
// takes focus so its reason is read out, but is not picked.
function arrowKeys(event: KeyboardEvent<HTMLElement>, group: HTMLElement | null) {
  const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
  if (!keys.includes(event.key) || !group) return;
  const radios = Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]'));
  const at = radios.indexOf(event.target as HTMLElement);
  if (at < 0) return;
  event.preventDefault();
  let next = at;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (at + 1) % radios.length;
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (at - 1 + radios.length) % radios.length;
  else if (event.key === "Home") next = 0;
  else next = radios.length - 1;
  radios[next]?.focus();
  if (radios[next]?.getAttribute("aria-disabled") !== "true") radios[next]?.click();
}

// A row that scrolls sideways: a swipe on a phone or touchpad, the mouse wheel on a
// laptop or PC. Each tile snaps into place.
function SwipeRow({ labelledBy, children }: { labelledBy: string; children: ReactNode }) {
  const row = useRef<HTMLDivElement>(null);
  useWheelScroll(row);
  return (
    <div
      ref={row}
      role="radiogroup"
      aria-labelledby={labelledBy}
      onKeyDown={(e) => arrowKeys(e, row.current)}
      className="-mx-1 flex snap-x snap-proximity gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]"
    >
      {children}
    </div>
  );
}

const tile =
  "flex min-h-11 w-full items-center gap-2 rounded-full border px-4 py-2 text-left text-sm transition-[border-color,background-color,color] duration-150";
const tileState = (on: boolean, locked: boolean) =>
  `${on ? "border-accent bg-accent font-semibold text-ink" : "border-control text-text hover:border-muted"} ${
    locked ? "cursor-not-allowed opacity-50" : ""
  }`;

export function ExtraPicker({
  sounds,
  rules,
  voiceMinPaise,
  hasMessage,
  selected,
  amountPaise,
  onSelect,
}: {
  sounds: TipSound[];
  rules: TipRule[];
  voiceMinPaise: number | null;
  hasMessage: boolean;
  selected: Extra;
  amountPaise: number;
  onSelect: (extra: Extra) => void;
}) {
  const uid = useId();
  const preview = useAudioPreview();
  const voiceGroup = useRef<HTMLDivElement>(null);
  const voiceLocked = voiceMinPaise !== null && amountPaise < voiceMinPaise;
  const voiceOn = selected.kind === "voice";
  const defaultOn = selected.kind === "default";

  // Tapping the one already picked puts it back to the streamer's default.
  const toggle = (extra: Extra, on: boolean) => onSelect(on ? { kind: "default" } : extra);

  return (
    <div className="space-y-6">
      {voiceMinPaise !== null && (
        <div className="space-y-3">
          <p id={`${uid}-voice`} className="text-sm text-muted">
            Streamer&apos;s choice or voice <span className="text-control">(optional)</span>
          </p>
          <div
            ref={voiceGroup}
            role="radiogroup"
            aria-labelledby={`${uid}-voice`}
            onKeyDown={(e) => arrowKeys(e, voiceGroup.current)}
            className="grid gap-2 sm:grid-cols-2"
          >
            <button
              type="button"
              role="radio"
              aria-checked={defaultOn}
              tabIndex={voiceOn ? -1 : 0}
              onClick={() => onSelect({ kind: "default" })}
              className={`${tile} ${tileState(defaultOn, false)}`}
            >
              <Sparkle weight="bold" aria-hidden="true" className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">Streamer&apos;s default</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={voiceOn}
              aria-disabled={voiceLocked || undefined}
              aria-describedby={voiceLocked ? `${uid}-voice-needs` : undefined}
              tabIndex={voiceOn ? 0 : -1}
              onClick={() => {
                if (!voiceLocked) onSelect({ kind: "voice" });
              }}
              className={`${tile} ${tileState(voiceOn, voiceLocked)}`}
            >
              <SpeakerHigh weight="bold" aria-hidden="true" className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">Read my message aloud</span>
              <span className={`numeric shrink-0 text-xs ${voiceOn ? "text-ink/85" : "text-muted"}`}>
                ₹{rupeesOf(voiceMinPaise)}+
              </span>
              {voiceLocked && (
                <span id={`${uid}-voice-needs`} className="sr-only">
                  Tip ₹{rupeesOf(voiceMinPaise)} or more to have your message read aloud.
                </span>
              )}
            </button>
          </div>
          {voiceOn && !hasMessage && <FieldNote>Write a message above for the voice to read.</FieldNote>}
        </div>
      )}

      {sounds.length > 0 && (
        <div className="space-y-3">
          <p id={`${uid}-sounds`} className="text-sm text-muted">
            Soundboard <span className="text-control">(optional, pick one; your message is not read aloud with a sound)</span>
          </p>
          <SwipeRow labelledBy={`${uid}-sounds`}>
            {sounds.map((s, i) => {
              const on = selected.kind === "sound" && selected.id === s.id;
              const locked = amountPaise < s.minPaise;
              const firstStop = selected.kind === "sound" ? on : i === 0;
              return (
                <div key={s.id} className="flex w-60 shrink-0 snap-start items-center gap-1.5">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-disabled={locked || undefined}
                    aria-describedby={locked ? `${uid}-s${s.id}-needs` : undefined}
                    tabIndex={firstStop ? 0 : -1}
                    onClick={() => {
                      if (!locked) toggle({ kind: "sound", id: s.id }, on);
                    }}
                    className={`${tile} ${tileState(on, locked)}`}
                  >
                    {s.emoji ? (
                      <span aria-hidden="true" className="w-4 shrink-0 text-center">
                        {s.emoji}
                      </span>
                    ) : (
                      <MusicNote weight="bold" aria-hidden="true" className="size-4 shrink-0" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    <span className={`numeric shrink-0 text-xs ${on ? "text-ink/85" : "text-muted"}`}>
                      {s.minPaise ? `₹${rupeesOf(s.minPaise)}+` : "any"}
                    </span>
                    {locked && (
                      <span id={`${uid}-s${s.id}-needs`} className="sr-only">
                        Tip ₹{rupeesOf(s.minPaise)} or more to play {s.name}.
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => preview.toggle(s.url)}
                    aria-label={`${preview.playing === s.url ? "Pause" : "Preview"} ${s.name}`}
                    aria-pressed={preview.playing === s.url}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-control text-text transition-[transform,border-color] duration-150 hover:border-muted active:scale-[0.95]"
                  >
                    {preview.playing === s.url ? (
                      <Pause weight="fill" aria-hidden="true" className="size-3.5" />
                    ) : (
                      <Play weight="fill" aria-hidden="true" className="size-3.5" />
                    )}
                  </button>
                </div>
              );
            })}
          </SwipeRow>
          {sounds.length > 1 && <p className="text-xs text-muted">Swipe sideways, or scroll, for more sounds.</p>}
        </div>
      )}

      {rules.length > 0 && (
        <div className="space-y-3">
          <p id={`${uid}-picks`} className="text-sm text-muted">
            Streamer&apos;s picks <span className="text-control">(a fixed amount, plays on its own with no message)</span>
          </p>
          <SwipeRow labelledBy={`${uid}-picks`}>
            {rules.map((r, i) => {
              const on = selected.kind === "rule" && selected.id === r.id;
              const firstStop = selected.kind === "rule" ? on : i === 0;
              return (
                <button
                  key={r.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  tabIndex={firstStop ? 0 : -1}
                  onClick={() => {
                    if (!on && r.sound) preview.play(r.sound.url);
                    else if (on && r.sound && preview.playing === r.sound.url) preview.stop();
                    toggle({ kind: "rule", id: r.id }, on);
                  }}
                  className={`flex w-36 shrink-0 snap-start flex-col overflow-hidden rounded-[var(--radius-field)] border text-left transition-[border-color,background-color] duration-150 ${
                    on ? "border-accent bg-accent text-ink" : "border-control text-text hover:border-muted"
                  }`}
                >
                  <span className="relative flex h-24 w-full items-center justify-center overflow-hidden bg-ground">
                    {r.media ? (
                      r.media.kind === "webm" ? (
                        <video
                          src={r.media.url}
                          muted
                          loop
                          autoPlay
                          playsInline
                          preload="metadata"
                          aria-hidden="true"
                          className="size-full object-cover"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element -- the creator's own upload, kept animated and unoptimised
                        <img src={r.media.url} alt="" loading="lazy" className="size-full object-cover" />
                      )
                    ) : r.sound ? (
                      <MusicNote weight="bold" aria-hidden="true" className="size-8 text-muted" />
                    ) : (
                      <Timer weight="bold" aria-hidden="true" className="size-8 text-muted" />
                    )}
                    {r.media && r.sound && (
                      <span aria-hidden="true" className="absolute bottom-1 right-1 rounded-full bg-ink/70 p-1 text-text">
                        <SpeakerHigh weight="fill" className="size-3" />
                      </span>
                    )}
                  </span>
                  <span className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="numeric font-semibold">₹{rupeesOf(r.minPaise)}</span>
                    <span className="sr-only">
                      {[r.media ? `shows ${r.media.name}` : "", r.sound ? `plays ${r.sound.name}` : ""].filter(Boolean).join(", ")}
                    </span>
                    {r.media ? (
                      <FilmSlate weight="bold" aria-hidden="true" className="size-4 shrink-0 opacity-70" />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </SwipeRow>
          {rules.length > 2 && <p className="text-xs text-muted">Swipe sideways, or scroll, for more.</p>}
        </div>
      )}
    </div>
  );
}
