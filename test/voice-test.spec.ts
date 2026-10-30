import { expect, test } from "@playwright/test";
import { prepareSpeech, limitsFromEnv, testLimits, withinLimits, TEST_SHARE } from "../src/lib/tts-pure";
import { prepareTestText, TEST_INPUT_MAX, TEST_SAMPLES } from "../src/lib/voice-test";

test.describe("test voice button rules", () => {
  test("the ready-made samples pass the filter and read in the right voice", () => {
    for (const s of TEST_SAMPLES) expect(prepareTestText(s.text, 300, []), s.label).toEqual({ ok: true, text: s.text });
    expect(prepareSpeech(TEST_SAMPLES[0].text).language).toBe("hi-IN");
    expect(prepareSpeech(TEST_SAMPLES[1].text).language).toBe("hi-IN");
    expect(prepareSpeech(TEST_SAMPLES[2].text).language).toBe("en-IN");
    // The Hinglish samples are fully converted, no Roman Hindi left behind.
    expect(prepareSpeech(TEST_SAMPLES[0].text).text).toBe("भाई क्या मस्त stream है, मैंने पचास रुपये भेजे हैं, चाय पी लेना");
  });

  test("nothing typed, or something that is not text, is refused", () => {
    for (const bad of ["", "   ", "🔥🔥🔥", "https://example.com", 42, null, undefined, {}]) {
      expect(prepareTestText(bad, 100, []).ok, String(bad)).toBe(false);
    }
  });

  test("a blocked word is refused, the built-in list and the creator's own", () => {
    expect(prepareTestText("you are a bitch", 100, [])).toMatchObject({ ok: false });
    expect(prepareTestText("b i t c h", 100, [])).toMatchObject({ ok: false });
    expect(prepareTestText("this has the word pineapple", 100, ["pineapple"])).toMatchObject({ ok: false });
    expect(prepareTestText("this has the word pineapple", 100, [])).toMatchObject({ ok: true });
  });

  test("the text is cleaned and cut like a real message", () => {
    expect(prepareTestText("great 🔥 stream https://spam.example soooooo good", 100, [])).toEqual({
      ok: true,
      text: "great stream soo good",
    });
    const long = "a".repeat(10) + " " + "word ".repeat(200);
    const cut = prepareTestText(long, 50, []);
    expect(cut.ok && cut.text.length).toBeLessThanOrEqual(50);
    const capped = prepareTestText("word ".repeat(200), 5000, []);
    expect(capped.ok && capped.text.length).toBeLessThanOrEqual(TEST_INPUT_MAX);
  });

  test("tests get half of a creator's daily characters and the site cap is unchanged", () => {
    const limits = limitsFromEnv({});
    const share = testLimits(limits);
    expect(TEST_SHARE).toBe(0.5);
    expect(share).toEqual({ creatorDailyChars: 1500, siteMonthlyChars: 400_000 });
    // 1,400 used so far today: a 100-character test fits, a 101-character one does not,
    // though a real alert of 101 still would.
    expect(withinLimits({ creatorToday: 1400, siteMonth: 0 }, 100, share)).toBe(true);
    expect(withinLimits({ creatorToday: 1400, siteMonth: 0 }, 101, share)).toBe(false);
    expect(withinLimits({ creatorToday: 1400, siteMonth: 0 }, 101, limits)).toBe(true);
  });
});
