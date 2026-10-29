"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { repairAudio } from "@/lib/audio-repair";
import {
  SOUND_EMOJI_MAX,
  SOUND_NAME_MAX,
  cleanSoundName,
  soundFileName,
  soundPathPrefix,
} from "@/lib/sounds";
import { addSound, deleteSound, setDefaultSound, updateSound } from "@/app/actions/sounds";

export interface SoundRow {
  id: number;
  name: string;
  emoji: string;
  minRupees: number;
  volume: number;
  enabled: boolean;
  url: string;
  durationMs: number;
}

interface Props {
  creatorId: number;
  sounds: SoundRow[];
  defaultSoundId: number | null;
  usedBytes: number;
  maxBytes: number;
  maxSounds: number;
  uploadsReady: boolean;
}

interface Progress {
  key: number;
  file: string;
  state: "working" | "done" | "failed";
  text: string;
}

const mb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

const field =
  "h-11 rounded-[var(--radius-field)] border border-control bg-ground px-3 text-base text-text placeholder:text-muted transition-[border-color] focus:border-accent focus:outline-none";
const smallButton =
  "inline-flex h-10 items-center rounded-full border border-control px-4 text-sm font-medium text-text transition-[transform,border-color] duration-150 hover:border-muted active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50";

// One audio element at a time, so previews never stack up.
let previewing: HTMLAudioElement | null = null;
function preview(url: string, volume: number) {
  previewing?.pause();
  const audio = new Audio(url);
  audio.volume = volume / 100;
  previewing = audio;
  audio.play().catch(() => {});
}

export function SoundsManager({
  creatorId,
  sounds,
  defaultSoundId,
  usedBytes,
  maxBytes,
  maxSounds,
  uploadsReady,
}: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const full = sounds.length >= maxSounds;

  async function handleFiles(files: FileList | null) {
    if (!files?.length || busy) return;
    setBusy(true);
    setError("");
    const list = Array.from(files);
    setProgress(list.map((f, i) => ({ key: i, file: f.name, state: "working", text: "Waiting…" })));
    const set = (key: number, state: Progress["state"], text: string) =>
      setProgress((prev) => prev.map((p) => (p.key === key ? { ...p, state, text } : p)));

    let room = maxSounds - sounds.length;
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      if (room <= 0) {
        set(i, "failed", `You can keep up to ${maxSounds} sounds.`);
        continue;
      }
      set(i, "working", "Checking and repairing…");
      const repaired = await repairAudio(file);
      if (!repaired.ok) {
        set(i, "failed", repaired.reason);
        continue;
      }

      const name = cleanSoundName(file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ")) || "New sound";
      try {
        set(i, "working", "Uploading…");
        const blob = await upload(`${soundPathPrefix(creatorId)}${soundFileName(name)}`, repaired.blob, {
          access: "public",
          handleUploadUrl: "/api/sounds/upload",
          contentType: "audio/wav",
        });
        set(i, "working", "Saving…");
        const saved = await addSound({
          url: blob.url,
          name,
          emoji: "",
          minRupees: 0,
          volume: 100,
          makeDefault: false,
        });
        if (saved.status === "error") {
          set(i, "failed", saved.message);
          continue;
        }
        room -= 1;
        set(i, "done", repaired.repaired ? "Added (the file was repaired)." : "Added.");
      } catch {
        set(i, "failed", "The upload failed. Check your connection and try again.");
      }
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  async function makeDefault(id: number | null) {
    setError("");
    const res = await setDefaultSound(id);
    if (res.status === "error") setError(res.message);
    else router.refresh();
  }

  return (
    <div className="space-y-6">
      {!uploadsReady && (
        <p role="alert" className="rounded-[var(--radius-surface)] border border-line/60 bg-surface p-5 text-sm text-muted">
          Sound uploads are not switched on yet. They need a storage setting that the site owner adds.
        </p>
      )}

      <div className="space-y-3 rounded-[var(--radius-surface)] border border-line/60 bg-surface p-6">
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted">Add sounds</h2>
        <p className="text-sm text-muted">
          MP3, WAV, OGG or M4A, up to 30 seconds and 8 MB each. You can pick several at once. A file that
          is damaged or in an odd format is repaired for you; one that cannot be read is turned down with
          a reason.
        </p>
        <input
          ref={input}
          id="sound-files"
          type="file"
          multiple
          accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
          disabled={!uploadsReady || busy || full}
          onChange={(e) => handleFiles(e.target.files)}
          className="sr-only"
        />
        <label
          htmlFor="sound-files"
          className={`inline-flex h-12 cursor-pointer items-center rounded-full bg-accent px-6 text-sm font-semibold text-ink transition-transform duration-150 active:scale-[0.97] ${
            !uploadsReady || busy || full ? "pointer-events-none opacity-50" : ""
          }`}
        >
          {busy ? "Working…" : "Choose files"}
        </label>
        <p className="numeric text-xs text-muted">
          {sounds.length} of {maxSounds} sounds · {mb(usedBytes)} of {mb(maxBytes)} MB used
        </p>
        {progress.length > 0 && (
          <ul aria-live="polite" className="space-y-1 text-sm">
            {progress.map((p) => (
              <li key={p.key} className={p.state === "failed" ? "text-red-400" : p.state === "done" ? "text-accent" : "text-muted"}>
                <span className="font-medium">{p.file}</span>: {p.text}
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      {sounds.length === 0 ? (
        <p className="rounded-[var(--radius-surface)] border border-line/60 bg-surface p-6 text-muted">
          No sounds yet. Add a few and fans will see them on your tip page.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted">Your sounds</h2>
            {defaultSoundId !== null && (
              <button type="button" onClick={() => makeDefault(null)} className="text-sm text-muted underline decoration-line hover:decoration-accent">
                Play no sound by default
              </button>
            )}
          </div>
          <ul className="space-y-3">
            {sounds.map((s) => (
              <SoundItem
                key={`${s.id}-${s.name}-${s.emoji}-${s.minRupees}-${s.volume}-${s.enabled}`}
                sound={s}
                isDefault={s.id === defaultSoundId}
                onDefault={() => makeDefault(s.id)}
                onChanged={() => router.refresh()}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SoundItem({
  sound,
  isDefault,
  onDefault,
  onChanged,
}: {
  sound: SoundRow;
  isDefault: boolean;
  onDefault: () => void;
  onChanged: () => void;
}) {
  const [name, setName] = useState(sound.name);
  const [emoji, setEmoji] = useState(sound.emoji);
  const [minRupees, setMinRupees] = useState(String(sound.minRupees));
  const [volume, setVolume] = useState(sound.volume);
  const [enabled, setEnabled] = useState(sound.enabled);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  const dirty =
    name !== sound.name ||
    emoji !== sound.emoji ||
    minRupees !== String(sound.minRupees) ||
    volume !== sound.volume ||
    enabled !== sound.enabled;

  async function save() {
    setWorking(true);
    setMessage("");
    const res = await updateSound(sound.id, {
      name,
      emoji,
      minRupees: parseInt(minRupees, 10),
      volume,
      enabled,
    });
    setWorking(false);
    if (res.status === "error") setMessage(res.message);
    else onChanged();
  }

  async function remove() {
    if (!window.confirm(`Delete "${sound.name}"? Fans can no longer pick it.`)) return;
    setWorking(true);
    const res = await deleteSound(sound.id);
    setWorking(false);
    if (res.status === "error") setMessage(res.message);
    else onChanged();
  }

  return (
    <li className="space-y-4 rounded-[var(--radius-surface)] border border-line/60 bg-surface p-5">
      <div className="flex items-center gap-2">
        <input
          aria-label="Emoji"
          value={emoji}
          maxLength={SOUND_EMOJI_MAX * 2}
          onChange={(e) => setEmoji(e.target.value)}
          placeholder="🔊"
          className={`${field} w-14 shrink-0 px-0 text-center`}
        />
        <input
          aria-label="Sound name"
          value={name}
          maxLength={SOUND_NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          className={`${field} min-w-0 flex-1`}
        />
        <button type="button" onClick={() => preview(sound.url, volume)} className={smallButton} aria-label={`Play ${sound.name}`}>
          ▶ Play
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-widest text-muted">Minimum tip (₹)</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={10000}
            value={minRupees}
            onChange={(e) => setMinRupees(e.target.value)}
            className={`${field} numeric w-full`}
          />
        </label>
        <label className="space-y-1">
          <span className="flex justify-between text-xs uppercase tracking-widest text-muted">
            <span>Volume</span>
            <span className="numeric">{volume}%</span>
          </span>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="h-11 w-full accent-accent"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-text">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-4 accent-accent" />
            Fans can pick it
          </label>
          <span className="numeric text-xs text-muted">{seconds(sound.durationMs)}</span>
          {isDefault ? (
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-ink">Default</span>
          ) : (
            <button type="button" onClick={onDefault} className="text-sm text-muted underline decoration-line hover:decoration-accent">
              Make default
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {dirty && (
            <button type="button" disabled={working} onClick={save} className={`${smallButton} border-accent`}>
              Save
            </button>
          )}
          <button type="button" disabled={working} onClick={remove} className={smallButton}>
            Delete
          </button>
        </div>
      </div>
      {message && (
        <p role="alert" className="text-sm text-red-400">
          {message}
        </p>
      )}
    </li>
  );
}
