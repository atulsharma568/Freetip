import { expect, test } from "@playwright/test";
import { cleanForSpeech, findBlockedWord, parseBannedWords } from "../src/lib/message-filter";
import { shouldSpeak, type SpeechSettings, type SpeechTip } from "../src/lib/tts-rules";

test.describe("word filter", () => {
  test("catches built-in English and Hindi abuse", () => {
    expect(findBlockedWord("you are a bitch")).not.toBeNull();
    expect(findBlockedWord("tu chutiya hai")).not.toBeNull();
    expect(findBlockedWord("तू हरामी है")).not.toBeNull();
    expect(findBlockedWord("what the fucking hell")).not.toBeNull();
  });

  test("catches disguises", () => {
    expect(findBlockedWord("f u c k")).not.toBeNull();
    expect(findBlockedWord("f.u.c.k this")).not.toBeNull();
    expect(findBlockedWord("fuuuuck")).not.toBeNull();
    expect(findBlockedWord("sh!t")).not.toBeNull();
    expect(findBlockedWord("b1tch")).not.toBeNull();
    expect(findBlockedWord("BITCH")).not.toBeNull();
  });

  test("leaves innocent words alone", () => {
    for (const ok of ["class", "Scunthorpe", "peacock", "assistant", "Niger is a country", "great stream bhai", "100!!!", "shitake mushrooms"]) {
      expect(findBlockedWord(ok), ok).toBeNull();
    }
  });

  test("uses the creator's own words and phrases", () => {
    expect(findBlockedWord("play my song", ["song"])).not.toBeNull();
    expect(findBlockedWord("PLAY MY SONG", ["my song"])).not.toBeNull();
    expect(findBlockedWord("songs are fun", ["song"])).not.toBeNull();
    expect(findBlockedWord("playlist", ["song"])).toBeNull();
    expect(findBlockedWord("hello", [])).toBeNull();
  });

  test("nothing to check", () => {
    expect(findBlockedWord(null)).toBeNull();
    expect(findBlockedWord("")).toBeNull();
  });

  test("parses the settings box", () => {
    expect(parseBannedWords("Spam, scam\nspam\n  \nx\n" + "y".repeat(31))).toEqual(["spam", "scam"]);
    expect(parseBannedWords(null)).toEqual([]);
    expect(parseBannedWords(Array.from({ length: 150 }, (_, i) => `word${i}`).join(","))).toHaveLength(100);
  });
});

test.describe("cleanup before speech", () => {
  test("removes links, emails, emoji and symbol noise", () => {
    expect(cleanForSpeech("hi https://x.com/a www.y.in me@a.com 🧩 **great** #stream", 300)).toBe("hi great stream");
  });

  test("reads common emoji aloud by name", () => {
    expect(cleanForSpeech("great stream 🔥", 300)).toBe("great stream fire");
    expect(cleanForSpeech("thanks ❤️❤️❤️", 300)).toBe("thanks heart");
    expect(cleanForSpeech("🔥😂🙏👍", 300)).toBe("fire laughing thank you");
    expect(cleanForSpeech("👍🏽 nice", 300)).toBe("thumbs up nice");
    expect(cleanForSpeech("भाई मस्त 🔥", 300)).toBe("भाई मस्त आग");
  });

  test("shortens floods", () => {
    expect(cleanForSpeech("sooooooo good!!!!!!", 300)).toBe("soo good!");
    expect(cleanForSpeech("wait......what", 300)).toBe("wait.what");
  });

  test("keeps Devanagari and numbers", () => {
    expect(cleanForSpeech("भाई ₹500 मस्त stream", 300)).toBe("भाई ₹500 मस्त stream");
  });

  test("returns null when nothing readable is left", () => {
    expect(cleanForSpeech("🧩🧩 !!! ***", 300)).toBeNull();
    expect(cleanForSpeech("https://x.com", 300)).toBeNull();
    expect(cleanForSpeech(null, 300)).toBeNull();
  });

  test("cuts to the limit after cleaning", () => {
    expect(cleanForSpeech("🧩🧩🧩🧩 abcdef", 3)).toBe("abc");
  });
});

test.describe("voice and the filter", () => {
  const settings: SpeechSettings = { ttsEnabled: true, approveBeforePlay: false, ttsMinPaise: 100 };
  const tip = (message: string): SpeechTip => ({ message, messageStatus: "approved", amountPaise: 10000, requested: true });

  test("never reads a message with a blocked word", () => {
    expect(shouldSpeak(settings, tip("nice one"), 150)).toBe(true);
    expect(shouldSpeak(settings, tip("you bitch"), 150)).toBe(false);
    expect(shouldSpeak({ ...settings, bannedWords: ["nice"] }, tip("nice one"), 150)).toBe(false);
  });
});
