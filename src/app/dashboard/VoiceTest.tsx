"use client";

import { useState, useTransition } from "react";
import { testVoice, type VoiceTestResult } from "@/app/actions/voice-test";
import { TEST_INPUT_MAX } from "@/lib/voice-test";

export function VoiceTest({ maxChars }: { maxChars: number }) {
  const limit = Math.min(maxChars, TEST_INPUT_MAX);
  const [text, setText] = useState<string>("");
  const [result, setResult] = useState<VoiceTestResult | null>(null);
  const [pending, startTransition] = useTransition();

  function speak() {
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await testVoice(text));
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

      <button
        type="button"
        onClick={speak}
        disabled={pending || !text.trim()}
        className="inline-flex h-12 items-center rounded-full bg-accent px-6 text-sm font-semibold text-ink transition-opacity duration-200 disabled:opacity-40"
      >
        {pending ? "Making the voice…" : "Test voice"}
      </button>

      <div aria-live="polite">
        {result?.status === "error" && (
          <p role="alert" className="text-sm text-red-400">
            {result.message}
          </p>
        )}
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
                <span lang={result.language === "hi-IN" ? "hi" : "en"} className="text-text">
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
