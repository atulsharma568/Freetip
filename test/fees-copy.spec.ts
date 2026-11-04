import { expect, test } from "@playwright/test";
import { FEES, feeBreakdown } from "../src/lib/legal";
import { PLATFORM_BPS, PROCESSING_BPS, splitTip } from "../src/lib/money";

// Pure modules only: run with `npx playwright test -c playwright.unit.config.ts
// test/fees-copy.spec.ts`. The worked example printed on the home page, the
// pricing page and the terms must be what the money rules really give.
const money = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

test.describe("published fee example", () => {
  test("the percentages come from the money rules", () => {
    expect(FEES.platformPercent).toBe(PLATFORM_BPS / 100);
    expect(FEES.gatewayPercent).toBe(PROCESSING_BPS / 100);
    expect(FEES.platformPercent).toBe(5);
    expect(FEES.gatewayPercent).toBe(3);
  });

  test("feeBreakdown(100) is the example printed on the site", () => {
    expect(feeBreakdown(100)).toEqual(FEES.example);
    expect(FEES.example).toEqual({
      tip: "₹100.00",
      platform: "−₹5.00",
      gateway: "−₹3.00",
      keep: "₹92.00",
    });
  });

  test("feeBreakdown agrees with splitTip for whole-rupee tips", () => {
    for (const rupees of [1, 2, 3, 7, 50, 99, 100, 101, 250, 500, 999, 1000, 1999, 2000, 12345]) {
      const s = splitTip(rupees * 100);
      expect(feeBreakdown(rupees)).toEqual({
        tip: money(s.grossPaise),
        platform: `−${money(s.platformFeePaise)}`,
        gateway: `−${money(s.processingPaise)}`,
        keep: money(s.creatorSharePaise),
      });
    }
  });

  test("the parts of a breakdown add back up to the tip", () => {
    const toPaise = (text: string) => Math.round(Number(text.replace(/[^0-9.]/g, "")) * 100);
    for (const rupees of [1, 3, 7, 50, 100, 1000]) {
      const b = feeBreakdown(rupees);
      expect(toPaise(b.platform) + toPaise(b.gateway) + toPaise(b.keep)).toBe(toPaise(b.tip));
    }
  });
});
