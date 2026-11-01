import { expect, test } from "@playwright/test";
import { wordTimings } from "../src/components/overlay/speech-words";
import { tipTierLevel } from "../src/lib/tip-tier";

test.describe("alert word highlight timing", () => {
  test("words follow each other across the speech clip", () => {
    const t = wordTimings("great stream today", 3000);
    expect(t.map((w) => w.word)).toEqual(["great", "stream", "today"]);
    expect(t[0].startMs).toBe(0);
    for (let i = 1; i < t.length; i++) {
      expect(t[i].startMs).toBeGreaterThanOrEqual(t[i - 1].startMs + t[i - 1].durMs - 1);
    }
    const last = t[t.length - 1];
    expect(last.startMs + last.durMs).toBeLessThanOrEqual(3001);
  });

  test("a sound before the voice pushes every word later", () => {
    const t = wordTimings("hello there", 2000, 1200);
    expect(t[0].startMs).toBe(1200);
  });

  test("longer words and pauses take longer, and a blank message has no words", () => {
    const t = wordTimings("a, extraordinary", 2000);
    expect(t[1].durMs).toBeGreaterThan(t[0].durMs);
    expect(wordTimings("   ", 2000)).toEqual([]);
  });
});

test.describe("tip tier level", () => {
  test("steps up at the same amounts as the label", () => {
    expect([0, 99, 100, 499, 500, 1999, 2000, 50000].map(tipTierLevel)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(tipTierLevel(Number.NaN)).toBe(0);
  });
});
