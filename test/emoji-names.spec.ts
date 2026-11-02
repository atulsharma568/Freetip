import { expect, test } from "@playwright/test";
import { DISTINCT_EMOJI, EMOJI_NAMES } from "../src/lib/emoji-names";
import { CLDR_EMOJI_NAMES } from "../src/lib/emoji-names-cldr";
import { cleanForSpeech } from "../src/lib/message-filter";

// The Test voice button once seemed to read "the previous emoji" because several
// different emoji shared one spoken name (😂 🤣 😆 all "laughing"). No two emoji may
// sound the same, in English or in Hindi.
test.describe("emoji names are distinct", () => {
  const strip = (e: string) => e.replace(/\u{fe0f}/gu, "");
  const all = new Map<string, readonly [string, string]>();
  for (const [e, names] of Object.entries(CLDR_EMOJI_NAMES)) all.set(strip(e), names);
  for (const [e, names] of EMOJI_NAMES) all.set(strip(e), names);

  for (const [index, label] of [
    [0, "English"],
    [1, "Hindi"],
  ] as const) {
    test(`no two emoji share a ${label} name`, () => {
      const seen = new Map<string, string[]>();
      for (const [e, names] of all) seen.set(names[index], [...(seen.get(names[index]) ?? []), e]);
      const shared = [...seen].filter(([, emoji]) => emoji.length > 1).map(([name, emoji]) => `${emoji.join(" ")} => ${name}`);
      expect(shared).toEqual([]);
    });
  }

  test("every deliberately renamed emoji still has both names", () => {
    for (const e of DISTINCT_EMOJI) expect(EMOJI_NAMES.has(e), e).toBe(true);
  });

  test("swapping one emoji for a similar one changes what is spoken", () => {
    for (const [a, b] of [["😂", "🤣"], ["🎉", "🎊"], ["🐶", "🐕"], ["😄", "😀"], ["🌸", "🌺"]]) {
      expect(cleanForSpeech(`hello ${a}`, 70), `${a} vs ${b}`).not.toBe(cleanForSpeech(`hello ${b}`, 70));
      expect(cleanForSpeech(a, 70), `${a} vs ${b} alone`).not.toBe(cleanForSpeech(b, 70));
    }
  });
});
