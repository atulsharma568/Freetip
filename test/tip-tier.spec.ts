import { expect, test } from "@playwright/test";
import { tipTier } from "../src/lib/tip-tier";

test.describe("tip tier label", () => {
  test("the label steps up at ₹100, ₹500 and ₹2,000", () => {
    expect(tipTier(0)).toBe("A quick thank-you");
    expect(tipTier(99)).toBe("A quick thank-you");
    expect(tipTier(100)).toBe("A solid boost");
    expect(tipTier(499)).toBe("A solid boost");
    expect(tipTier(500)).toBe("Big support");
    expect(tipTier(1999)).toBe("Big support");
    expect(tipTier(2000)).toBe("Stream-changing");
    expect(tipTier(100000)).toBe("Stream-changing");
  });

  test("a bad amount falls back to the smallest label", () => {
    expect(tipTier(Number.NaN)).toBe("A quick thank-you");
    expect(tipTier(-5)).toBe("A quick thank-you");
  });
});
