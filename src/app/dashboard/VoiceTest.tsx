"use client";

import { useState, useTransition } from "react";
import { testVoice, type VoiceTestResult } from "@/app/actions/voice-test";
import { regionalLanguage, type RegionalLang } from "@/lib/regional-voices";
import { TEST_INPUT_MAX } from "@/lib/voice-test";
import { RollText } from "@/components/motion/RollText";
import { ChipRadio } from "./parts/Controls";
import { Msg } from "./parts/Msg";
import { pillPrimary } from "./parts/styles";

// `sampleLang`: the creator's regional language while that switch is on, which adds a
// button that fills the box with a short sentence in it.
export function VoiceTest({ maxChars, sampleLang = null }: { maxChars: number; sampleLang?: RegionalLang | null }) {
  const limit = Math.min(maxChars, TEST_INPUT_MAX);
  const [text, setText] = useState<string>("");
  const [gender, setGender] = useState<"female" | "male">("female");
  const [result, setResult] = useState<VoiceTestResult | null>(null);
  const [pending, startTransition] = useTransition();

  function speak() {
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await testVoice(text, gender));
      } catch {
        setResult({ status: "error", message: "Could not run the test. Reload the page and try again." });
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Hear what your fans&apos; messages sound like, with no payment. It runs your message through
        the same cleanup and word filter as a real alert, then through the real voice.
      </p>

      <div className="space-y-2">
        <label htmlFor="voice-test-text" className="text-xs text-muted">
          Message to read ({text.length}/{limit})
        </label>
        <textarea
          id="voice-test-text"
          value={text}
          maxLength={limit}
          rows={3}
          placeholder="Type a message to hear it read aloud"
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-[var(--radius-field)] border border-control bg-ground px-4 py-3 text-base text-text placeholder:text-muted focus:border-accent"
        />
      </div>

      {sampleLang && (
        <button
          type="button"
          onClick={() => setText(regionalLanguage(sampleLang).sample.slice(0, limit))}
          className="text-xs text-muted underline decoration-line underline-offset-4 transition-colors hover:text-text hover:decoration-accent"
        >
          Fill in a {regionalLanguage(sampleLang).label} sample
        </button>
      )}

      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">Voice to test</legend>
        {(["female", "male"] as const).map((g) => (
          <ChipRadio key={g} name="voice-test-gender" value={g} checked={gender === g} onChange={() => setGender(g)}>
            {g === "female" ? "Female voice" : "Male voice"}
          </ChipRadio>
        ))}
      </fieldset>

      <button
        type="button"
        onClick={speak}
        disabled={pending || !text.trim()}
        className={pillPrimary}
      >
        <RollText>{pending ? "Making the voice…" : "Test voice"}</RollText>
      </button>

      <div aria-live="polite">
        <Msg kind={result?.status === "error" ? "error" : undefined} text={result?.status === "error" ? result.message : undefined} />
        {result?.status === "ok" && (
          <div className="space-y-3">
            {/* Browsers may refuse to start sound after a wait, so the player is
                always there to press play. */}
            <audio
              key={result.audio.length + result.spoken}
              controls
              autoPlay
              src={`data:audio/mpeg;base64,${result.audio}`}
              className="w-full"
            />
            <div className="space-y-1 text-sm text-muted">
              <p>
                Read as:{" "}
                <span lang={result.language.slice(0, 2)} className="text-text">
                  {result.spoken}
                </span>
              </p>
              <p className="text-xs">
                {result.voice} ({result.engine === "azure" ? "Azure Speech" : "Amazon Polly"})
                {result.cached ? ", from the cache" : ""}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
