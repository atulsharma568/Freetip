import { expect, test } from "@playwright/test";
import { hindiSpeech, hinglishScore, isHinglish, knownSpellings, transliterateHinglish as t } from "../src/lib/hinglish";
import { WORDS } from "../src/lib/hinglish-words";

test.describe("Hinglish converter", () => {
  test("converts Roman Hindi and leaves English and punctuation alone", () => {
    expect(t("bhai kya mast stream hai")).toBe("भाई क्या मस्त stream है");
    expect(t("Bhai, bahut accha khela!")).toBe("भाई, बहुत अच्छा खेला!");
    expect(t("BHAI KYA SCENE HAI")).toBe("भाई क्या SCENE है");
    expect(t("great stream today, keep it up")).toBe("great stream today, keep it up");
  });

  test("words that are also English only convert inside Hindi", () => {
    expect(t("welcome to the stream bhai")).toBe("welcome to the stream भाई");
    expect(t("mouse mat")).toBe("mouse mat");
    expect(t("main to gaya bhai")).toBe("मैं तो गया भाई");
    expect(t("Jett main hu bhai")).toBe("Jett main हूँ भाई");
    expect(t("mera main duelist hai")).toBe("मेरा main duelist है");
    expect(t("jai shri ram")).toBe("जय श्री राम");
    expect(t("I upgraded my ram to 16gb")).toBe("I upgraded my ram to 16gb");
  });

  test("things stuck to other characters are not words", () => {
    expect(t("@bhai is playing lo-fi")).toBe("@bhai is playing lo-fi");
    expect(t("visit bhai.com")).toBe("visit bhai.com");
    expect(t("2din ka plan hai")).toBe("2din का plan है");
  });

  test("common respellings reach the same word", () => {
    expect(t("acchaa bhaii")).toBe("अच्छा भाई");
    expect(t("nahii pata bhai")).toBe("नहीं पता भाई");
    expect(t("kyaa scene hai")).toBe("क्या scene है");
    expect(t("zyada mazaa")).toBe("ज़्यादा मज़ा");
    expect(t("jyada majaa")).toBe("ज़्यादा मज़ा");
  });

  test("English words and names are not caught by a respelling", () => {
    expect(t("a salon in a niche, Kamal said hello")).toBe("a salon in a niche, Kamal said hello");
    expect(t("the class sat at the bar to take water")).toBe("the class sat at the bar to take water");
  });

  test("every respelling points at the same Devanagari as its word", () => {
    const spellings = knownSpellings();
    expect(spellings.size).toBeGreaterThan(Object.keys(WORDS).length);
    for (const [word, dev] of Object.entries(WORDS)) expect(spellings.get(word)).toBe(dev);
    for (const dev of spellings.values()) expect(dev).toMatch(/[ऀ-ॿ]/);
  });

  test("detects Hindi messages and passes English through", () => {
    expect(isHinglish("bhai kya mast stream hai")).toBe(true);
    expect(isHinglish("मस्त stream")).toBe(true);
    expect(isHinglish("lo and behold, great stream")).toBe(false);
    expect(hinglishScore("")).toBe(0);
    expect(hindiSpeech("great stream today")).toEqual({ text: "great stream today", hindi: false });
    expect(hindiSpeech("bhai bahut mast")).toEqual({ text: "भाई बहुत मस्त", hindi: true });
  });
});
