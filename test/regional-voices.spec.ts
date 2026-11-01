import { expect, test } from "@playwright/test";
import {
  effectiveRegionalLang,
  hasRegionalScript,
  parseRegionalLang,
  REGIONAL_LANGUAGES,
} from "../src/lib/regional-voices";
import { azureVoice, buildSsml, isPollyLanguage, prepareSpeech } from "../src/lib/tts-pure";
import { cleanForSpeech, findBlockedWord } from "../src/lib/message-filter";
import { prepareTestText } from "../src/lib/voice-test";
import { FEATURES, hasFeature } from "../src/lib/plans";

// Every name below was read off Microsoft's Azure Speech language-support page on
// 2026-11-01 (standard neural voices, one female and one male per language). If a name
// here is ever changed, check that page first: a wrong name means a silent alert.
const VERIFIED: Record<string, [string, string]> = {
  "ta-IN": ["ta-IN-PallaviNeural", "ta-IN-ValluvarNeural"],
  "te-IN": ["te-IN-ShrutiNeural", "te-IN-MohanNeural"],
  "kn-IN": ["kn-IN-SapnaNeural", "kn-IN-GaganNeural"],
  "ml-IN": ["ml-IN-SobhanaNeural", "ml-IN-MidhunNeural"],
  "bn-IN": ["bn-IN-TanishaaNeural", "bn-IN-BashkarNeural"],
  "gu-IN": ["gu-IN-DhwaniNeural", "gu-IN-NiranjanNeural"],
  "mr-IN": ["mr-IN-AarohiNeural", "mr-IN-ManoharNeural"],
};

test.describe("regional voices: the language table", () => {
  test("the seven languages and their voices are exactly the verified ones", () => {
    expect(REGIONAL_LANGUAGES.map((l) => l.code).sort()).toEqual(Object.keys(VERIFIED).sort());
    for (const l of REGIONAL_LANGUAGES) {
      expect([l.female, l.male], l.code).toEqual(VERIFIED[l.code]);
      expect(azureVoice(l.code, {}), l.code).toBe(l.female);
      expect(azureVoice(l.code, {}, "male"), l.code).toBe(l.male);
      // A voice name starts with its own locale.
      expect(l.female.startsWith(l.code) && l.male.startsWith(l.code), l.code).toBe(true);
    }
  });

  test("Hindi and English voices are unchanged, and the Hindi override still works", () => {
    expect(azureVoice("hi-IN", {})).toBe("hi-IN-SwaraNeural");
    expect(azureVoice("en-IN", {}, "male")).toBe("en-IN-PrabhatNeural");
    expect(azureVoice("hi-IN", { AZURE_SPEECH_VOICE_HI: "hi-IN-MadhurNeural" })).toBe("hi-IN-MadhurNeural");
    // The Hindi override never leaks into a regional voice.
    expect(azureVoice("ta-IN", { AZURE_SPEECH_VOICE_HI: "hi-IN-MadhurNeural", AZURE_SPEECH_VOICE_EN: "x" })).toBe(
      "ta-IN-PallaviNeural",
    );
  });

  test("only Hindi and English can fall back to Polly", () => {
    expect(isPollyLanguage("hi-IN")).toBe(true);
    expect(isPollyLanguage("en-IN")).toBe(true);
    for (const l of REGIONAL_LANGUAGES) expect(isPollyLanguage(l.code), l.code).toBe(false);
  });

  test("parseRegionalLang accepts the seven codes and nothing else", () => {
    for (const code of Object.keys(VERIFIED)) expect(parseRegionalLang(code)).toBe(code);
    for (const bad of ["", "hi-IN", "en-IN", "ta", "TA-IN", "ta-IN ", null, undefined, 7, {}, "constructor"]) {
      expect(parseRegionalLang(bad), String(bad)).toBeNull();
    }
  });

  test("the SSML names the regional language", () => {
    const ssml = buildSsml("x", "ta-IN", "ta-IN-PallaviNeural");
    expect(ssml).toContain('xml:lang="ta-IN"');
    expect(ssml).toContain('<voice name="ta-IN-PallaviNeural">');
  });
});

test.describe("regional voices: which language a message is read in", () => {
  test("each sample is read in its own language when the creator chose it", () => {
    for (const l of REGIONAL_LANGUAGES) {
      expect(prepareSpeech(l.sample, l.code), l.code).toEqual({ text: l.sample, language: l.code });
    }
  });

  test("with no regional language nothing changes", () => {
    expect(prepareSpeech("bhai kya mast stream hai")).toEqual({ text: "भाई क्या मस्त stream है", language: "hi-IN" });
    expect(prepareSpeech("bhai kya mast stream hai", null).language).toBe("hi-IN");
    expect(prepareSpeech("great stream today", null)).toEqual({ text: "great stream today", language: "en-IN" });
    // Tamil letters with no choice made keep today's behaviour.
    const tamil = REGIONAL_LANGUAGES[0].sample;
    expect(prepareSpeech(tamil, null).language).toBe("en-IN");
  });

  test("only the creator's language counts: another script is not read in it", () => {
    const telugu = REGIONAL_LANGUAGES.find((l) => l.code === "te-IN")!.sample;
    expect(prepareSpeech(telugu, "ta-IN").language).toBe("en-IN");
  });

  test("English and Roman-letter messages stay with the English voice", () => {
    expect(prepareSpeech("Super stream anna, keep going", "ta-IN")).toEqual({
      text: "Super stream anna, keep going",
      language: "en-IN",
    });
    expect(prepareSpeech("Eppadi irukinga, nalla stream", "ta-IN").language).toBe("en-IN");
  });

  test("a mixed message with the creator's script is read in that language", () => {
    expect(prepareSpeech("இன்று stream super", "ta-IN").language).toBe("ta-IN");
  });

  test("Marathi creator: typed Devanagari is Marathi, Roman Hinglish is still Hindi", () => {
    const marathi = REGIONAL_LANGUAGES.find((l) => l.code === "mr-IN")!.sample;
    expect(prepareSpeech(marathi, "mr-IN").language).toBe("mr-IN");
    expect(prepareSpeech("मस्त stream", "mr-IN").language).toBe("mr-IN");
    expect(prepareSpeech("bhai kya mast stream hai", "mr-IN")).toEqual({
      text: "भाई क्या मस्त stream है",
      language: "hi-IN",
    });
    expect(prepareSpeech("great stream today", "mr-IN").language).toBe("en-IN");
  });

  test("a Tamil creator's Devanagari message is still Hindi", () => {
    expect(prepareSpeech("मस्त stream", "ta-IN").language).toBe("hi-IN");
  });
});

test.describe("regional voices: the switch", () => {
  const on = { paid_features: ["regionalVoices"], tts_lang: "ml-IN" };

  test("the language applies only while the switch is on", () => {
    expect(effectiveRegionalLang(on)).toBe("ml-IN");
    expect(effectiveRegionalLang({ ...on, paid_features: [] })).toBeNull();
    expect(effectiveRegionalLang({ ...on, paid_features: null })).toBeNull();
    expect(effectiveRegionalLang(null)).toBeNull();
    expect(effectiveRegionalLang(undefined)).toBeNull();
  });

  test("a saved language that is not one of the seven plays as none", () => {
    expect(effectiveRegionalLang({ paid_features: ["regionalVoices"], tts_lang: null })).toBeNull();
    expect(effectiveRegionalLang({ paid_features: ["regionalVoices"], tts_lang: "xx-IN" })).toBeNull();
  });

  test("the feature exists, is built and is off unless stored", () => {
    const f = FEATURES.find((x) => x.key === "regionalVoices")!;
    expect(f.built).toBe(true);
    expect(hasFeature({ paid_features: [] }, "regionalVoices")).toBe(false);
    expect(hasFeature({ paid_features: ["regionalVoices"] }, "regionalVoices")).toBe(true);
  });
});

test.describe("regional voices: cleanup before speech", () => {
  test("the samples pass the test button's cleanup unchanged", () => {
    for (const l of REGIONAL_LANGUAGES) {
      expect(prepareTestText(l.sample, 300, []), l.code).toEqual({ ok: true, text: l.sample });
    }
  });

  test("letters are never cut short and a joiner inside a word is kept", () => {
    // Malayalam chillu typed with a joiner (ZWJ), and Bengali ra with ZWNJ.
    const chillu = "\u0D28\u200D\u0D28";
    expect(cleanForSpeech(chillu, 50)).toBe(chillu);
    const bengali = "\u09B0\u200C\u0995";
    expect(cleanForSpeech(bengali, 50)).toBe(bengali);
  });

  test("hidden characters are still removed everywhere else", () => {
    // Zero-width space, a joiner next to a space or the edge, direction marks.
    expect(cleanForSpeech("a\u200Bb c \u200Dd", 50)).toBe("a b c d");
    expect(cleanForSpeech("a\u200Eb", 50)).toBe("a b");
    expect(cleanForSpeech("\u200D hello \u200C", 50)).toBe("hello");
    expect(cleanForSpeech("tip\u202Eedoc", 50)).toBe("tip edoc");
  });

  test("an emoji in a regional message is skipped, not read as English or Hindi words", () => {
    const tamil = REGIONAL_LANGUAGES[0].sample;
    expect(cleanForSpeech(`${tamil} 🔥`, 200)).toBe(tamil);
    expect(hasRegionalScript(`${tamil} 🔥`)).toBe(true);
    // Everywhere else emoji are still named, as before.
    expect(cleanForSpeech("great stream 🔥", 200)).toContain("fire");
  });

  test("a word the creator banned is still caught in a regional script", () => {
    const tamil = REGIONAL_LANGUAGES[0].sample;
    const word = tamil.split(" ")[0];
    expect(findBlockedWord(tamil, [word])).not.toBeNull();
    expect(findBlockedWord(tamil, [])).toBeNull();
  });
});
