import { expect, test } from "@playwright/test";
import { messageLimitFor, nextMessageStep } from "../src/lib/message-limit";

test.describe("message length by tip size", () => {
  test("the default 150 gives 80, 110 and 150 across the three steps", () => {
    expect(messageLimitFor(150, 2000)).toBe(80); // ₹20
    expect(messageLimitFor(150, 9999)).toBe(80); // just under ₹100
    expect(messageLimitFor(150, 10000)).toBe(110); // ₹100
    expect(messageLimitFor(150, 29999)).toBe(110); // just under ₹300
    expect(messageLimitFor(150, 30000)).toBe(150); // ₹300
    expect(messageLimitFor(150, 10_000_000)).toBe(150);
  });

  test("never goes above the creator's limit or below 30", () => {
    expect(messageLimitFor(500, 100)).toBe(250);
    expect(messageLimitFor(500, 30000)).toBe(500);
    expect(messageLimitFor(40, 100)).toBe(30); // half of 40 is 20, the floor wins
    expect(messageLimitFor(20, 100)).toBe(20); // the ceiling is below the floor
    expect(messageLimitFor(10, 30000)).toBe(10);
  });

  test("a missing or odd amount gets the smallest step", () => {
    expect(messageLimitFor(150, 0)).toBe(80);
    expect(messageLimitFor(150, Number.NaN)).toBe(80);
  });

  test("the hint names the next tip size that allows more", () => {
    expect(nextMessageStep(150, 2000)).toEqual({ rupees: 100, limit: 110 });
    expect(nextMessageStep(150, 10000)).toEqual({ rupees: 300, limit: 150 });
    expect(nextMessageStep(150, 30000)).toBeNull();
  });

  test("no hint when a bigger tip would not allow more", () => {
    // A 30-character ceiling is the same at every step.
    expect(nextMessageStep(30, 2000)).toBeNull();
    // 40 characters: 30 under ₹100, 30 from ₹100, 40 from ₹300.
    expect(nextMessageStep(40, 2000)).toEqual({ rupees: 300, limit: 40 });
  });
});
