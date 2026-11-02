"use client";

import { useActionState, useState } from "react";
import { TickLoader } from "@/components/ui/TickLoader";
import { RollText } from "@/components/motion/RollText";
import { saveSettings } from "@/app/actions/creator";
import { SETTINGS_IDLE } from "@/lib/creator-state";
import type { AlertMode } from "@/lib/alerts";
import { MAX_BANNED_LIST_CHARS } from "@/lib/message-filter";
import { MIN_TIP_PAISE } from "@/lib/money";
import { REGIONAL_LANGUAGES } from "@/lib/regional-voices";
import { ACCENT_PRESETS, inkFor } from "@/lib/accent";
import { ChipRadio, OptionRadio, Range, SelectField, Toggle } from "./parts/Controls";
import { Msg } from "./parts/Msg";
import { field, peerRing, pillPrimary, smallLabel } from "./parts/styles";

const ALERT_OPTIONS: { value: AlertMode; label: string; hint: string }[] = [
  { value: "instant", label: "Play everything at once", hint: "Name, amount and message show as soon as the tip lands." },
  { value: "split", label: "Message after approval", hint: "Name and amount show at once; the message waits for you." },
  { value: "approve", label: "Everything after approval", hint: "Nothing shows until you approve the message." },
];

const MIN_TIP_OPTIONS = [20, 49, 99, 199, 499];

const BIO_MAX = 160;
const DISPLAY_NAME_MAX = 50;

interface Props {
  displayName: string;
  messageMaxChars: number;
  ttsEnabled: boolean;
  ttsMinPaise: number;
  // The owner's site-wide minimum for the voice; a lower amount above is raised to it.
  ttsFloorPaise?: number;
  approveBeforePlay: boolean;
  alertMode: AlertMode;
  bio: string;
  bannedWords: string;
  // The stored accent colour, already checked (the default lime when none is set).
  accent: string;
  // The site-wide voice switch (owner). When off, the voice controls are replaced
  // by a note, and the saved values are kept as they are.
  ttsAvailable: boolean;
  voiceGender: "female" | "male";
  // The paid "Regional language voices" switch, and the saved language ("" for none).
  // Without the switch the picker is not shown and the saved language is left alone.
  regionalVoices: boolean;
  voiceLang: string;
}

// One titled group of controls; the groups are headed and divided, but all
// still save together with one button.
function Group({ title, hint, children, first }: { title: string; hint: string; children: React.ReactNode; first?: boolean }) {
  return (
    <section className={`space-y-6 ${first ? "" : "border-t border-control pt-8"}`}>
      <div className="space-y-1">
        <h4 className="text-lg font-semibold text-text">{title}</h4>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      {children}
    </section>
  );
}

export function SettingsForm({ displayName: initialDisplayName, messageMaxChars, ttsEnabled, ttsMinPaise, ttsFloorPaise = 0, approveBeforePlay, alertMode, bio: initialBio, bannedWords: initialBanned, accent, ttsAvailable, voiceGender, regionalVoices, voiceLang: initialVoiceLang }: Props) {
  const [state, action, pending] = useActionState(saveSettings, SETTINGS_IDLE);

  // A stored colour that is not a preset came from "Auto"; it keeps its own swatch.
  const storedPreset = ACCENT_PRESETS.find((p) => p.hex === accent);
  const [accentChoice, setAccentChoice] = useState(storedPreset ? storedPreset.id : "keep");
  const accentOptions = [
    ...ACCENT_PRESETS.map((p) => ({ id: p.id, label: p.label, hex: p.hex })),
    ...(storedPreset ? [] : [{ id: "keep", label: "From your picture", hex: accent }]),
  ];

  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [tts, setTts] = useState(ttsEnabled);
  const [gender, setGender] = useState(voiceGender);
  const [voiceLang, setVoiceLang] = useState(initialVoiceLang);
  const [approve, setApprove] = useState(approveBeforePlay);
  const [ttsMin, setTtsMin] = useState(Math.round(ttsMinPaise / 100));
  const [chars, setChars] = useState(messageMaxChars);
  const [bio, setBio] = useState(initialBio);
  const [banned, setBanned] = useState(initialBanned);
  const [isDirty, setIsDirty] = useState(false);

  return (
    <form
      action={(formData) => { setIsDirty(false); action(formData); }}
      className="space-y-8"
      onChange={() => setIsDirty(true)}
    >
      <Group first title="Your page" hint="How your tip page looks to fans.">
      {/* Display name */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="creator-display-name" className={smallLabel}>
            Display name
          </label>
          <span className="text-xs text-muted">{displayName.length}/{DISPLAY_NAME_MAX}</span>
        </div>
        <input
          id="creator-display-name"
          name="display_name"
          type="text"
          maxLength={DISPLAY_NAME_MAX}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your streamer name"
          className={field}
        />
        <p className="text-xs text-muted">Shown on your tip page. Defaults to your Google name.</p>
      </div>

      {/* Bio */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="creator-bio" className={smallLabel}>
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
          className="w-full resize-none rounded-[var(--radius-field)] border border-control bg-ground px-4 py-3 text-base text-text placeholder:text-muted transition-[border-color] focus:border-accent"
        />
        <p className="text-xs text-muted">Shown on your public tip page.</p>
      </div>

      {/* Page colour */}
      <fieldset className="space-y-3">
        <legend className={smallLabel}>Page colour</legend>
        <div role="radiogroup" aria-label="Page colour" className="flex flex-wrap gap-2">
          {accentOptions.map((o) => {
            const on = accentChoice === o.id;
            return (
              <label key={o.id} className="cursor-pointer" title={o.label}>
                <input
                  type="radio"
                  name="accent"
                  value={o.id}
                  checked={on}
                  onChange={() => setAccentChoice(o.id)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`flex size-11 items-center justify-center rounded-full border-2 text-base font-semibold transition-transform active:scale-[0.95] ${
                    on ? "border-text" : "border-transparent"
                  } ${peerRing}`}
                  style={{ backgroundColor: o.hex, color: inkFor(o.hex) }}
                >
                  {on ? "✓" : ""}
                </span>
                <span className="sr-only">{o.label}</span>
              </label>
            );
          })}
          <label className="cursor-pointer" title="Pick a colour from your profile picture">
            <input
              type="radio"
              name="accent"
              value="auto"
              checked={accentChoice === "auto"}
              onChange={() => setAccentChoice("auto")}
              className="peer sr-only"
            />
            <span
              className={`flex h-11 items-center rounded-full border border-control px-4 text-sm text-text transition-colors peer-checked:border-accent peer-checked:bg-accent peer-checked:font-semibold peer-checked:text-ink ${peerRing}`}
            >
              Auto from my picture
            </span>
          </label>
        </div>
        <p className="text-xs text-muted">Colours your public tip page. Save to apply.</p>
      </fieldset>

      </Group>

      <Group title="Tips and messages" hint="What fans can send, and what is kept off your stream.">
      {/* Min tip: fixed for everyone */}
      <div className="space-y-1">
        <p className={smallLabel}>Minimum tip</p>
        <p className="text-base text-text">₹{MIN_TIP_PAISE / 100}</p>
        <p className="text-xs text-muted">The same for every creator on Freetip.</p>
      </div>

      {/* Message limit */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="msg-chars" className={smallLabel}>
            Longest message
          </label>
          <span id="msg-chars-value" className="text-sm text-text">{chars} chars</span>
        </div>
        <Range
          id="msg-chars"
          name="message_max_chars"
          min={10}
          max={500}
          step={10}
          value={chars}
          onChange={(v) => {
            setChars(v);
            setIsDirty(true);
          }}
          unit="characters"
          aria-describedby="msg-chars-value"
        />
        <div className="flex justify-between text-xs text-muted">
          <span>10</span>
          <span>500</span>
        </div>
        <p className="text-xs text-muted">
          Fans get this many characters when they tip ₹300 or more. Smaller tips get
          less: about three quarters from ₹100, and half under ₹100.
        </p>
      </div>

      {/* Banned words */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="banned-words" className={smallLabel}>
            Banned words
          </label>
          <span className="text-xs text-muted">{banned.length}/{MAX_BANNED_LIST_CHARS}</span>
        </div>
        <textarea
          id="banned-words"
          name="banned_words"
          rows={3}
          maxLength={MAX_BANNED_LIST_CHARS}
          value={banned}
          onChange={(e) => setBanned(e.target.value)}
          aria-describedby="banned-words-hint"
          className="w-full resize-none rounded-[var(--radius-field)] border border-control bg-ground px-4 py-3 text-base text-text placeholder:text-muted transition-[border-color] focus:border-accent"
        />
        <p id="banned-words-hint" className="text-xs text-muted">
          One word or phrase per line, or separated by commas. A tip with one in the name or message is
          turned away before payment, and never shown or read on stream. Only the words you list are blocked.
        </p>
      </div>

      </Group>

      <Group title="On stream" hint="How alerts show up and whether messages are read aloud.">
      {/* Alert mode */}
      <fieldset className="space-y-3">
        <legend className={smallLabel}>
          Stream alerts
        </legend>
        <div className="space-y-2">
          {ALERT_OPTIONS.map((o) => (
            <OptionRadio key={o.value} name="alert_mode" value={o.value} defaultChecked={o.value === alertMode} hint={o.hint}>
              {o.label}
            </OptionRadio>
          ))}
        </div>
      </fieldset>

      {/* TTS */}
      {!ttsAvailable ? (
        <div className="space-y-2">
          <p className={smallLabel}>Voice for messages</p>
          <p className="text-sm text-muted">
            Reading a fan&apos;s message aloud is coming soon. Your sounds work in the meantime, and your
            voice settings will be kept.
          </p>
          <input type="hidden" name="tts_enabled" value={tts ? "on" : "off"} />
          <input type="hidden" name="approve_before_play" value={approve ? "on" : "off"} />
          <input type="hidden" name="tts_min" value={ttsMin} />
          <input type="hidden" name="tts_voice" value={gender} />
        </div>
      ) : (
        <div className="space-y-3">
          <Toggle
            id="tts-toggle"
            checked={tts}
            onChange={(v) => {
              setTts(v);
              setIsDirty(true);
            }}
          >
            Text-to-speech
          </Toggle>
          <input type="hidden" name="tts_enabled" value={tts ? "on" : "off"} />
          <fieldset className="space-y-2">
            <legend className="text-sm text-text">Voice</legend>
            <div className="flex flex-wrap gap-2">
              {(["female", "male"] as const).map((g) => (
                <ChipRadio key={g} name="tts_voice" value={g} checked={gender === g} onChange={() => setGender(g)}>
                  {g === "female" ? "Female" : "Male"}
                </ChipRadio>
              ))}
            </div>
            <p className="text-xs text-muted">Use Test the voice below to hear it. If the main voice engine is down, a female voice is used instead.</p>
          </fieldset>
          {regionalVoices && (
            <div className="space-y-2">
              <label htmlFor="tts-lang" className="block text-sm text-text">
                Regional language
              </label>
              <SelectField
                id="tts-lang"
                name="tts_lang"
                value={voiceLang}
                onChange={(e) => {
                  setVoiceLang(e.target.value);
                  setIsDirty(true);
                }}
              >
                <option value="">None (Hindi and English)</option>
                {REGIONAL_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label} ({l.native})
                  </option>
                ))}
              </SelectField>
              <p className="text-xs text-muted">
                Messages a fan types in this language&apos;s own letters are read in it. Messages typed in English letters
                are read by the English voice. Marathi and Hindi share their letters, so with Marathi chosen, Devanagari
                is read as Marathi.
              </p>
            </div>
          )}
          {tts && (
            <div className="space-y-4 border-l border-line pl-4">
              <Toggle
                id="approve-toggle"
                checked={approve}
                onChange={(v) => {
                  setApprove(v);
                  setIsDirty(true);
                }}
                hint="Recommended"
              >
                Approve before play
              </Toggle>
              <div className="space-y-2">
                <label htmlFor="tts-min" className="block text-sm text-text">
                  Read aloud from
                </label>
                <SelectField id="tts-min" value={ttsMin} onChange={(e) => setTtsMin(Number(e.target.value))}>
                  {MIN_TIP_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      ₹{v} and above
                    </option>
                  ))}
                </SelectField>
                <p className="text-xs text-muted">
                  Fans can choose to have their message read aloud once their tip reaches this amount. A tip uses either a sound or the voice, not both. Only the message is read, never the name.
                  {ttsFloorPaise > 0 && ` Freetip reads messages aloud only for tips of ₹${Math.ceil(ttsFloorPaise / 100)} or more, so a lower amount here still starts at ₹${Math.ceil(ttsFloorPaise / 100)}.`}
                </p>
              </div>
            </div>
          )}
          {/* Always submit these so they aren't silently reset when TTS is off */}
          <input type="hidden" name="approve_before_play" value={approve ? "on" : "off"} />
          <input type="hidden" name="tts_min" value={ttsMin} />
        </div>
      )}

      </Group>

      {/* The bar sticks to the bottom of the screen while there is something unsaved. */}
      <div
        className={
          isDirty
            ? "sticky bottom-4 z-20 space-y-2 rounded-surface border border-control bg-raised p-3"
            : "space-y-2"
        }
      >
        <Msg
          kind={state.status === "error" ? "error" : state.status === "ok" && !pending && !isDirty ? "ok" : undefined}
          text={state.status === "error" ? state.message : "Settings saved."}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className={pillPrimary}>
            {pending ? (
              <>
                <TickLoader count={8} duration={0.7} className="text-ink" />
                Saving…
              </>
            ) : (
              <RollText>Save settings</RollText>
            )}
          </button>
          {isDirty && !pending && <span className="text-sm text-text">You have unsaved changes.</span>}
        </div>
      </div>
    </form>
  );
}
