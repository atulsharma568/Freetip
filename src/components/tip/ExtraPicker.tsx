"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { MusicNote, Play, Sparkle, SpeakerHigh } from "@phosphor-icons/react";
import type { TipSound } from "@/app/[handle]/creator";
import { FieldNote } from "./FieldNote";

// What the alert adds besides the card: nothing extra (the creator's own default
// sound plays, if they set one), one of their sounds, or the message read aloud.
// It is one choice, so a tip never has both a sound and a voice. A sound or the
// voice above the tip amount is locked and says what it takes to unlock it. The
// server checks the pick again.
export type Extra = { kind: "default" } | { kind: "sound"; id: number } | { kind: "voice" };

// One clip at a time, so previews never stack up.
let previewing: HTMLAudioElement | null = null;
function playPreview(url: string) {
  previewing?.pause();
  const audio = new Audio(url);
  previewing = audio;
  audio.play().catch(() => {});
}

const rupeesOf = (paise: number) => Math.ceil(paise / 100);

type Option = {
  key: string;
  extra: Extra;
  label: string;
  hint: string;
  locked: boolean;
  needs: string;
  icon: ReactNode;
  on: boolean;
};

export function ExtraPicker({
  sounds,
  voiceMinPaise,
  hasMessage,
  selected,
  amountPaise,
  onSelect,
}: {
  sounds: TipSound[];
  voiceMinPaise: number | null;
  hasMessage: boolean;
  selected: Extra;
  amountPaise: number;
  onSelect: (extra: Extra) => void;
}) {
  const uid = useId();
  const group = useRef<HTMLDivElement>(null);
  const voiceLocked = voiceMinPaise !== null && amountPaise < voiceMinPaise;

  const options: Option[] = [
    {
      key: "default",
      extra: { kind: "default" },
      label: "Streamer's default",
      hint: "",
      locked: false,
      needs: "",
      icon: <Sparkle weight="bold" aria-hidden="true" className="size-4 shrink-0" />,
      on: selected.kind === "default",
    },
  ];
  if (voiceMinPaise !== null) {
    options.push({
      key: "voice",
      extra: { kind: "voice" },
      label: "Read my message aloud",
      hint: `₹${rupeesOf(voiceMinPaise)}+`,
      locked: voiceLocked,
      needs: `Tip ₹${rupeesOf(voiceMinPaise)} or more to have your message read aloud.`,
      icon: <SpeakerHigh weight="bold" aria-hidden="true" className="size-4 shrink-0" />,
      on: selected.kind === "voice",
    });
  }
  for (const s of sounds) {
    options.push({
      key: `sound-${s.id}`,
      extra: { kind: "sound", id: s.id },
      label: s.name,
      hint: s.minPaise ? `₹${rupeesOf(s.minPaise)}+` : "any",
      locked: amountPaise < s.minPaise,
      needs: `Tip ₹${rupeesOf(s.minPaise)} or more to play ${s.name}.`,
      icon: s.emoji ? (
        <span aria-hidden="true" className="w-4 shrink-0 text-center">
          {s.emoji}
        </span>
      ) : (
        <MusicNote weight="bold" aria-hidden="true" className="size-4 shrink-0" />
      ),
      on: selected.kind === "sound" && selected.id === s.id,
    });
  }

  // Arrow keys move through the options like a native radio group: one tab
  // stop for the group, the arrows (and Home and End) move focus and pick.
  // A locked option takes focus so its reason is read out, but is not picked.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const radios = Array.from(group.current?.querySelectorAll<HTMLElement>('[role="radio"]') ?? []);
    const at = radios.indexOf(event.target as HTMLElement);
    if (at < 0) return;
    event.preventDefault();
    let next = at;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (at + 1) % radios.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (at - 1 + radios.length) % radios.length;
    else if (event.key === "Home") next = 0;
    else next = radios.length - 1;
    radios[next]?.focus();
    const option = options[next];
    if (option && !option.locked) onSelect(option.extra);
  }

  const tile =
    "flex min-h-11 w-full items-center gap-2 rounded-full border px-4 py-2 text-left text-sm transition-[border-color,background-color,color] duration-150";

  return (
    <div className="space-y-3">
      <p id={`${uid}-label`} className="text-sm text-muted">
        {voiceMinPaise !== null && sounds.length > 0
          ? "Add a sound or your voice"
          : voiceMinPaise !== null
            ? "Add your voice"
            : "Alert sound"}{" "}
        <span className="text-control">(optional, pick one)</span>
      </p>
      <div
        ref={group}
        role="radiogroup"
        aria-labelledby={`${uid}-label`}
        onKeyDown={onKeyDown}
        className="grid gap-2 sm:grid-cols-2"
      >
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={o.on}
            aria-disabled={o.locked || undefined}
            aria-describedby={o.locked ? `${uid}-${o.key}-needs` : undefined}
            tabIndex={o.on ? 0 : -1}
            onClick={() => {
              if (!o.locked) onSelect(o.extra);
            }}
            className={`${tile} ${
              o.on
                ? "border-accent bg-accent font-semibold text-ink"
                : "border-control text-text hover:border-muted"
            } ${o.locked ? "cursor-not-allowed opacity-50" : ""}`}
          >
            {o.icon}
            <span className="min-w-0 flex-1 truncate">{o.label}</span>
            {o.hint && (
              <span className={`numeric shrink-0 text-xs ${o.on ? "text-ink/85" : "text-muted"}`}>{o.hint}</span>
            )}
            {o.locked && (
              <span id={`${uid}-${o.key}-needs`} className="sr-only">
                {o.needs}
              </span>
            )}
          </button>
        ))}
      </div>
      {sounds.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted">Hear a sound first</p>
          <div className="flex flex-wrap gap-2">
            {sounds.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => playPreview(s.url)}
                aria-label={`Preview ${s.name}`}
                className="inline-flex h-11 max-w-full items-center gap-2 rounded-full border border-control px-4 text-sm text-text transition-[transform,border-color] duration-150 hover:border-muted active:scale-[0.97]"
              >
                <Play weight="fill" aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="min-w-0 truncate">{s.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {selected.kind === "voice" && !hasMessage && (
        <FieldNote>Write a message above for the voice to read.</FieldNote>
      )}
    </div>
  );
}
