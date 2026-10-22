"use client";

import { useActionState, useState } from "react";
import { Switch } from "@/components/ui/Switch";
import { TickLoader } from "@/components/ui/TickLoader";
import { saveSettings, SETTINGS_IDLE } from "@/app/actions/creator";

const MIN_TIP_OPTIONS = [1, 10, 20, 49, 99, 199, 499];

const BIO_MAX = 160;

interface Props {
  minTipPaise: number;
  messageMaxChars: number;
  ttsEnabled: boolean;
  approveBeforePlay: boolean;
  bio: string;
}

export function SettingsForm({ minTipPaise, messageMaxChars, ttsEnabled, approveBeforePlay, bio: initialBio }: Props) {
  const [state, action, pending] = useActionState(saveSettings, SETTINGS_IDLE);

  const [tts, setTts] = useState(ttsEnabled);
  const [approve, setApprove] = useState(approveBeforePlay);
  const [chars, setChars] = useState(messageMaxChars);
  const [bio, setBio] = useState(initialBio);
  const [isDirty, setIsDirty] = useState(false);

  return (
    <form action={action} className="space-y-6" onChange={() => setIsDirty(true)}>
      {/* Bio */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="creator-bio" className="text-sm font-medium uppercase tracking-widest text-muted">
            Bio
          </label>
          <span className="text-xs text-muted">{bio.length}/{BIO_MAX}</span>
        </div>
        <textarea
          id="creator-bio"
          name="bio"
          maxLength={BIO_MAX}
          rows={2}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Indian gaming streamer, live every night at 9 PM"
          className="w-full resize-none rounded-[var(--radius-field)] border border-control bg-ground px-4 py-3 text-base text-text placeholder:text-muted transition-[border-color] focus:border-accent focus:outline-none"
        />
        <p className="text-xs text-muted">Shown on your public tip page.</p>
      </div>

      {/* Min tip */}
      <div className="space-y-2">
        <label htmlFor="min-tip" className="text-sm font-medium uppercase tracking-widest text-muted">
          Minimum tip
        </label>
        <div className="relative">
        <select
          id="min-tip"
          name="min_tip"
          defaultValue={Math.round(minTipPaise / 100)}
          className="w-full h-12 rounded-[var(--radius-field)] border border-control bg-ground px-4 pr-10 text-base text-text focus:border-accent focus:outline-none transition-[border-color] appearance-none"
        >
          {MIN_TIP_OPTIONS.map((v) => (
            <option key={v} value={v}>
              ₹{v}
            </option>
          ))}
        </select>
        <span aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted">
          ↓
        </span>
        </div>
      </div>

      {/* Message limit */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="msg-chars" className="text-sm font-medium uppercase tracking-widest text-muted">
            Message limit
          </label>
          <span id="msg-chars-value" className="text-sm text-text">{chars} chars</span>
        </div>
        <input
          id="msg-chars"
          name="message_max_chars"
          type="range"
          min={10}
          max={500}
          step={10}
          value={chars}
          onChange={(e) => setChars(Number(e.target.value))}
          aria-valuetext={`${chars} characters`}
          aria-describedby="msg-chars-value"
          className="w-full accent-accent"
        />
        <div className="flex justify-between text-xs text-muted">
          <span>10</span>
          <span>500</span>
        </div>
      </div>

      {/* TTS */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Switch id="tts-toggle" checked={tts} onChange={setTts} />
          <input type="hidden" name="tts_enabled" value={tts ? "on" : "off"} />
          <label htmlFor="tts-toggle" className="cursor-pointer select-none text-sm text-text">
            Text-to-speech
          </label>
        </div>
        {tts && (
          <div className="flex items-center gap-3 pl-10">
            <Switch id="approve-toggle" checked={approve} onChange={setApprove} />
            <input type="hidden" name="approve_before_play" value={approve ? "on" : "off"} />
            <label htmlFor="approve-toggle" className="cursor-pointer select-none text-sm text-text">
              Approve before play
              <span className="ml-2 text-muted text-xs">(recommended)</span>
            </label>
          </div>
        )}
      </div>

      {/* Always-present live region so screen readers announce changes reliably */}
      <p aria-live="polite" aria-atomic="true" className="min-h-[1.25rem] text-sm">
        {state.status === "error" && (
          <span className="text-red-400">{state.message}</span>
        )}
        {state.status === "ok" && !pending && !isDirty && (
          <span className="text-text">Settings saved.</span>
        )}
      </p>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 items-center gap-3 rounded-full bg-accent px-6 text-sm font-semibold text-ink transition-opacity duration-200 disabled:opacity-40"
      >
        {pending ? (
          <>
            <TickLoader count={8} duration={0.7} className="text-ink" />
            Saving…
          </>
        ) : (
          "Save settings"
        )}
      </button>
    </form>
  );
}
