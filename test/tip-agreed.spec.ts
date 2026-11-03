import { expect, test } from "@playwright/test";
import { agreementError } from "../src/lib/tip-extras";

// A tip is final, so the server refuses an order the fan did not agree to, whatever the page sent
// (createTipOrder runs this check before anything else).
test.describe("the tip needs the agreement box", () => {
  test("only a real true is accepted", () => {
    expect(agreementError({ agreed: true })).toBeNull();
  });

  for (const [label, extras] of [
    ["no extras", {}],
    ["agreed missing", { voice: false }],
    ["agreed false", { agreed: false }],
    ["agreed a string", { agreed: "true" as unknown as boolean }],
    ["agreed a number", { agreed: 1 as unknown as boolean }],
  ] as const) {
    test(`an order with ${label} is refused`, () => {
      expect(agreementError(extras)).toBe("Please tick the box to confirm you understand this tip is final.");
    });
  }
});
