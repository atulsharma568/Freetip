import { expect, test } from "@playwright/test";
import { azureVoice, buildSsml, cacheKey, limitsFromEnv, prepareSpeech, withinLimits } from "../src/lib/tts-pure";

test.describe("speech engine rules", () => {
  test("a Hinglish message is read as Hindi in Devanagari, English stays English", () => {
    expect(prepareSpeech("bhai kya mast stream hai")).toEqual({ text: "भाई क्या मस्त stream है", language: "hi-IN" });
    expect(prepareSpeech("great stream today")).toEqual({ text: "great stream today", language: "en-IN" });
    expect(prepareSpeech("मस्त stream").language).toBe("hi-IN");
  });

  test("the voice follows the language and can be overridden", () => {
    expect(azureVoice("hi-IN", {})).toBe("hi-IN-SwaraNeural");
    expect(azureVoice("en-IN", {})).toBe("en-IN-NeerjaNeural");
    expect(azureVoice("hi-IN", { AZURE_SPEECH_VOICE_HI: "hi-IN-MadhurNeural" })).toBe("hi-IN-MadhurNeural");
  });

  test("a fan's text is escaped and can never become markup", () => {
    const ssml = buildSsml(`</voice><voice name="x">hack & "co" <b>`, "en-IN", "en-IN-NeerjaNeural");
    expect(ssml).toContain("&lt;/voice&gt;&lt;voice name=&quot;x&quot;&gt;hack &amp; &quot;co&quot; &lt;b&gt;");
    expect(ssml.match(/<voice /g)).toHaveLength(1);
    expect(ssml).toContain('xml:lang="en-IN"');
  });

  test("the cache key changes with engine, voice and text", () => {
    const a = cacheKey("azure", "v1", "hello");
    expect(cacheKey("azure", "v1", "hello")).toBe(a);
    expect(cacheKey("azure", "v2", "hello")).not.toBe(a);
    expect(cacheKey("polly", "v1", "hello")).not.toBe(a);
    expect(cacheKey("azure", "v1", "hello!")).not.toBe(a);
  });

  test("caps: defaults sit under Azure's free allowance, env overrides, bad values fall back", () => {
    expect(limitsFromEnv({})).toEqual({ creatorDailyChars: 3000, siteMonthlyChars: 400_000 });
    expect(limitsFromEnv({ TTS_DAILY_CHARS_PER_CREATOR: "500", TTS_MONTHLY_CHARS: "1000" })).toEqual({
      creatorDailyChars: 500,
      siteMonthlyChars: 1000,
    });
    expect(limitsFromEnv({ TTS_DAILY_CHARS_PER_CREATOR: "abc", TTS_MONTHLY_CHARS: "-5" })).toEqual({
      creatorDailyChars: 3000,
      siteMonthlyChars: 400_000,
    });
  });

  test("a clip must fit under both the creator's daily cap and the site's monthly cap", () => {
    const limits = { creatorDailyChars: 1000, siteMonthlyChars: 5000 };
    expect(withinLimits({ creatorToday: 900, siteMonth: 100 }, 100, limits)).toBe(true);
    expect(withinLimits({ creatorToday: 901, siteMonth: 100 }, 100, limits)).toBe(false);
    expect(withinLimits({ creatorToday: 0, siteMonth: 4950 }, 100, limits)).toBe(false);
  });
});
