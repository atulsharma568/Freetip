"use client";

import { useActionState, useState } from "react";
import { Switch } from "@/components/ui/Switch";
import { TickLoader } from "@/components/ui/TickLoader";
import { saveSettings, SETTINGS_IDLE } from "@/app/actions/creator";

const MIN_TIP_OPTIONS = [1, 10, 20, 49, 99, 199, 499];

interface Props {
  minTipPaise: number;
  messageMaxChars: number;
  ttsEnabled: boolean;
}

export function SettingsForm({ minTipPaise, messageMaxChars, ttsEnabled }: Props) {
  const [state, action, pending] = useActionState(saveSettings, SETTINGS_IDLE);

  const [tts, setTts] = useState(ttsEnabled);
  const [chars, setChars] = useState(messageMaxChars);

  return (
    <form action={action} className="space-y-6">
      {/* Min tip */}
      <div className="space-y-2">
        <label htmlFor="min-tip" className="text-sm font-medium uppercase tracking-widest text-muted">
          Minimum tip
        </label>
        <select
          id="min-tip"
          name="min_tip"
          defaultValue={Math.round(minTipPaise / 100)}
          className="w-full h-12 rounded-[var(--radius-field)] border border-control bg-ground px-4 text-base text-text focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_rgb(191_232_74/0.14)] transition-[border-color,box-shadow] appearance-none"
        >
          {MIN_TIP_OPTIONS.map((v) => (
            <option key={v} value={v}>
              ₹{v}
            </option>
          ))}
        </select>
      </div>

      {/* Message limit */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="msg-chars" className="text-sm font-medium uppercase tracking-widest text-muted">
            Message limit
          </label>
          <span className="numeric text-sm text-text">{chars} chars</span>
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
          className="w-full accent-accent"
        />
        <div className="flex justify-between text-xs text-muted">
          <span>10</span>
          <span>500</span>
        </div>
      </div>

      {/* TTS */}
      <div className="flex items-center gap-3">
        <Switch id="tts-toggle" checked={tts} onChange={setTts} />
        <input type="hidden" name="tts_enabled" value={tts ? "on" : "off"} />
        <label htmlFor="tts-toggle" className="cursor-pointer select-none text-sm text-text">
          Text-to-speech
          <span className="ml-2 text-muted">(approve before play)</span>
        </label>
      </div>

      {/* Feedback */}
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-400">{state.message}</p>
      )}
      {state.status === "ok" && !pending && (
        <p role="status" className="text-sm text-accent">Settings saved.</p>
      )}

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
