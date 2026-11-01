import { test, expect } from "@playwright/test";
import { tipThanksLine } from "../src/lib/alerts";

test("no message: the tip plays at once in every mode", () => {
  for (const mode of ["instant", "split", "approve"] as const) {
    expect(tipThanksLine(false, "", mode)).toBe("They'll see your tip on stream.");
    expect(tipThanksLine(false, "   ", mode)).toBe("They'll see your tip on stream.");
    expect(tipThanksLine(true, "", mode)).toBe("Your tip is on its way.");
  }
});

test("a message in approve mode waits for the creator, in split mode it follows", () => {
  expect(tipThanksLine(false, "hi", "approve")).toMatch(/once they approve/);
  expect(tipThanksLine(false, "hi", "approve")).not.toMatch(/on stream/);
  expect(tipThanksLine(false, "hi", "split")).toMatch(/shows on stream now.*once they approve/);
});

test("only instant mode promises the message on stream", () => {
  expect(tipThanksLine(false, "hi", "instant")).toBe("They'll see your message on stream.");
  expect(tipThanksLine(true, "hi", "instant")).toBe("Your tip is on its way.");
});
