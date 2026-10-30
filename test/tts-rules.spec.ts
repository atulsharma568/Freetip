import { expect, test } from "@playwright/test";
import {
  SPEECH_MAX_CHARS,
  checkVoicePick,
  languageFor,
  shouldSpeak,
  speechText,
  type SpeechSettings,
  type SpeechTip,
} from "../src/lib/tts-rules";

const on: SpeechSettings = { ttsEnabled: true, approveBeforePlay: true, ttsMinPaise: 4900 };
const tip = (over: Partial<SpeechTip> = {}): SpeechTip => ({
  message: "great stream",
  messageStatus: "approved",
  amountPaise: 10000,
  requested: true,
  ...over,
});

test.describe("text-to-speech rules", () => {
  test("speaks an approved message at or above the threshold", () => {
    expect(shouldSpeak(on, tip(), 150)).toBe(true);
    expect(shouldSpeak(on, tip({ amountPaise: 4900 }), 150)).toBe(true);
  });

  test("stays silent when text-to-speech is off", () => {
    expect(shouldSpeak({ ...on, ttsEnabled: false }, tip(), 150)).toBe(false);
  });

  test("stays silent below the threshold", () => {
    expect(shouldSpeak(on, tip({ amountPaise: 4899 }), 150)).toBe(false);
  });

  test("never speaks a rejected message, even with approval off", () => {
    const open = { ...on, approveBeforePlay: false };
    expect(shouldSpeak(open, tip({ messageStatus: "rejected" }), 150)).toBe(false);
  });

  test("a pending message waits for approval unless approval is off", () => {
    expect(shouldSpeak(on, tip({ messageStatus: "pending" }), 150)).toBe(false);
    expect(shouldSpeak({ ...on, approveBeforePlay: false }, tip({ messageStatus: "pending" }), 150)).toBe(true);
  });

  test("stays silent when there is nothing to say", () => {
    expect(shouldSpeak(on, tip({ message: null }), 150)).toBe(false);
    expect(shouldSpeak(on, tip({ message: "   " }), 150)).toBe(false);
    expect(shouldSpeak(on, tip({ message: "https://spam.example/x" }), 150)).toBe(false);
  });
});

test.describe("speech text", () => {
  test("drops links, invisible characters and extra spaces", () => {
    expect(speechText("hi   https://spam.example/x  www.spam.example\u200b bro", 150)).toBe("hi bro");
  });

  test("honours the creator's limit and the hard cap", () => {
    expect(speechText("abcdefghij", 5)).toBe("abcde");
    expect(speechText("a".repeat(1000), 1000)).toHaveLength(SPEECH_MAX_CHARS);
  });

  test("picks the language from the script", () => {
    expect(languageFor("great stream")).toBe("en-IN");
    expect(languageFor("बहुत बढ़िया stream")).toBe("hi-IN");
  });
});

test.describe("voice and sound are separate choices", () => {
  test("a message is read only when the fan asked for it", () => {
    expect(shouldSpeak(on, tip({ requested: false }), 150)).toBe(false);
    expect(shouldSpeak(on, tip({ requested: true }), 150)).toBe(true);
  });

  const ok = {
    platformOn: true,
    creatorEnabled: true,
    minPaise: 4900,
    amountPaise: 10000,
    message: "hello",
    hasSound: false,
  };

  test("a voice pick is allowed when everything lines up", () => {
    expect(checkVoicePick(ok)).toBeNull();
    expect(checkVoicePick({ ...ok, amountPaise: 4900 })).toBeNull();
  });

  test("a sound and a voice together are refused", () => {
    expect(checkVoicePick({ ...ok, hasSound: true })).toBe("Choose a sound or a spoken message, not both.");
  });

  test("refused when the site switch or the creator's setting is off", () => {
    expect(checkVoicePick({ ...ok, platformOn: false })).toMatch(/not available/);
    expect(checkVoicePick({ ...ok, creatorEnabled: false })).toMatch(/not available/);
  });

  test("refused with no message or a tip under the minimum", () => {
    expect(checkVoicePick({ ...ok, message: "   " })).toMatch(/Write a message/);
    expect(checkVoicePick({ ...ok, message: null })).toMatch(/Write a message/);
    expect(checkVoicePick({ ...ok, amountPaise: 4800 })).toBe("Tip at least ₹49 to have your message read aloud.");
  });
});
