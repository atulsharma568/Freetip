import { expect, test } from "@playwright/test";
import { EMOJI_NAMES } from "../src/lib/emoji-names";
import { CLDR_EMOJI_NAMES } from "../src/lib/emoji-names-cldr";
import { cleanForSpeech, findBlockedWord, parseBannedWords } from "../src/lib/message-filter";
import { shouldSpeak, type SpeechSettings, type SpeechTip } from "../src/lib/tts-rules";

test.describe("word filter", () => {
  test("blocks nothing of its own: no list, no block", () => {
    for (const rude of ["you are a bitch", "tu chutiya hai", "तू हरामी है", "what the fucking hell"]) {
      expect(findBlockedWord(rude), rude).toBeNull();
      expect(findBlockedWord(rude, []), rude).toBeNull();
    }
  });

  test("catches disguises of a word the creator listed", () => {
    const list = ["fuck", "shit", "bitch"];
    for (const t of ["f u c k", "f.u.c.k this", "fuuuuck", "sh!t", "b1tch", "BITCH"]) {
      expect(findBlockedWord(t, list), t).not.toBeNull();
    }
  });

  test("leaves innocent words alone", () => {
    for (const ok of ["class", "Scunthorpe", "peacock", "assistant", "Niger is a country", "great stream bhai", "100!!!", "shitake mushrooms"]) {
      expect(findBlockedWord(ok, ["fuck", "ass", "cunt", "shit", "nigger"]), ok).toBeNull();
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
    expect(cleanForSpeech("hi https://x.com/a www.y.in me@a.com © **great** #stream", 300)).toBe("hi great stream");
  });

  test("reads common emoji aloud by name", () => {
    expect(cleanForSpeech("great stream 🔥", 300)).toBe("great stream fire");
    expect(cleanForSpeech("thanks ❤️❤️❤️", 300)).toBe("thanks heart");
    expect(cleanForSpeech("wow 🔥😂🙏👍", 300)).toBe("wow fire laughing thank you");
    expect(cleanForSpeech("👍🏽 nice", 300)).toBe("thumbs up nice");
    expect(cleanForSpeech("भाई मस्त 🔥", 300)).toBe("भाई मस्त आग लगा दी");
    // Hinglish gets the playful Hindi names too
    expect(cleanForSpeech("bhai mast stream 😂", 300)).toBe("bhai mast stream हँसता हुआ चेहरा");
    expect(cleanForSpeech("bhai mast stream ❤️ 🍭", 300)).toBe("bhai mast stream गुलाबी दिल चूसने की मिठाई");
  });

  test("every listed emoji is a real emoji with a name in both languages", () => {
    expect(EMOJI_NAMES.size).toBeGreaterThan(600);
    for (const [emoji, [en, hi]] of EMOJI_NAMES) {
      expect(/^\p{Extended_Pictographic}$/u.test(emoji), emoji).toBe(true);
      expect(/^[a-z ]+$/.test(en), en).toBe(true);
      expect(/^[ऀ-ॿ ,]+$/.test(hi), hi).toBe(true);
    }
    expect(cleanForSpeech("bhai 🐶 🍎 🏏", 300)).toBe("bhai कुत्ता सेब क्रिकेट");
    expect(cleanForSpeech("nice 🦁", 300)).toBe("nice lion");
  });

  test("an emoji on its own gets the playful Hindi name", () => {
    expect(cleanForSpeech("😂", 300)).toBe("हँसता हुआ चेहरा");
    expect(cleanForSpeech("🍭❤️", 300)).toBe("चूसने की मिठाई गुलाबी दिल");
    expect(cleanForSpeech("🤰", 300)).toBe("बधाई हो, घर में नन्हा मेहमान आ रहा है");
    expect(cleanForSpeech("😮\u200d💨", 300)).toBe("लंबी साँस, चलो छोड़ो");
    expect(cleanForSpeech("nice 😂", 300)).toBe("nice laughing");
  });

  test("an emoji we have no playful name for is read by its official Unicode name", () => {
    for (const [emoji, [en, hi]] of Object.entries(CLDR_EMOJI_NAMES)) {
      expect(EMOJI_NAMES.has(emoji), emoji).toBe(false);
      expect(/^\p{Extended_Pictographic}$/u.test(emoji), emoji).toBe(true);
      expect(en.length > 0 && hi.length > 0, emoji).toBe(true);
    }
    expect(Object.keys(CLDR_EMOJI_NAMES).length).toBeGreaterThan(500);
    expect(cleanForSpeech("nice 🫫", 300)).toBe("nice cracking face");
    expect(cleanForSpeech("bhai mast 🫫", 300)).toBe("bhai mast दरकता चेहरा");

  });

  test("shortens floods", () => {
    expect(cleanForSpeech("sooooooo good!!!!!!", 300)).toBe("soo good!");
    expect(cleanForSpeech("wait......what", 300)).toBe("wait.what");
  });

  test("keeps Devanagari and numbers", () => {
    expect(cleanForSpeech("भाई ₹500 मस्त stream", 300)).toBe("भाई ₹500 मस्त stream");
  });

  test("returns null when nothing readable is left", () => {
    expect(cleanForSpeech("©© !!! ***", 300)).toBeNull();
    expect(cleanForSpeech("https://x.com", 300)).toBeNull();
    expect(cleanForSpeech(null, 300)).toBeNull();
  });

  test("cuts to the limit after cleaning", () => {
    expect(cleanForSpeech("©©©© abcdef", 3)).toBe("abc");
  });
});

test.describe("voice and the filter", () => {
  const settings: SpeechSettings = { ttsEnabled: true, approveBeforePlay: false, ttsMinPaise: 100 };
  const tip = (message: string): SpeechTip => ({ message, messageStatus: "approved", amountPaise: 10000, requested: true });

  test("never reads a message with a word the creator banned", () => {
    expect(shouldSpeak(settings, tip("nice one"), 150)).toBe(true);
    expect(shouldSpeak(settings, tip("you bitch"), 150)).toBe(true);
    expect(shouldSpeak({ ...settings, bannedWords: ["bitch"] }, tip("you bitch"), 150)).toBe(false);
    expect(shouldSpeak({ ...settings, bannedWords: ["nice"] }, tip("nice one"), 150)).toBe(false);
  });
});
