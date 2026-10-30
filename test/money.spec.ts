import { expect, test } from "@playwright/test";
import { capturePosting, feeLines, splitTip, toPaise } from "../src/lib/money";

test.describe("tip split (flat 2.5% processing charge)", () => {
  test("a ₹100 tip leaves the creator ₹92.50", () => {
    expect(splitTip(10000)).toEqual({
      grossPaise: 10000,
      platformFeePaise: 500,
      processingPaise: 250,
      creatorSharePaise: 9250,
    });
  });

  test("the ₹1 minimum gives non-zero lines and the parts add up", () => {
    const s = splitTip(100);
    expect(s.platformFeePaise).toBe(5);
    expect(s.processingPaise).toBe(3); // 2.5 rounds half up
    expect(s.creatorSharePaise).toBe(92);
    expect(s.platformFeePaise + s.processingPaise + s.creatorSharePaise).toBe(100);
  });

  test("rounds each charge half up to the paise", () => {
    // 1250 paise: 5% is 62.5 -> 63, 2.5% is 31.25 -> 31.
    expect(splitTip(1250)).toMatchObject({ platformFeePaise: 63, processingPaise: 31, creatorSharePaise: 1156 });
  });

  test("parts always add up across a wide range of amounts", () => {
    for (const gross of [100, 101, 149, 150, 199, 999, 1000, 4999, 5001, 200000, 200001, 9999999, 10000000]) {
      const s = splitTip(gross);
      expect(s.platformFeePaise + s.processingPaise + s.creatorSharePaise).toBe(gross);
      expect(s.creatorSharePaise).toBeGreaterThan(0);
    }
  });

  test("refuses amounts that are not positive whole paise", () => {
    for (const bad of [0, -100, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 2]) {
      expect(() => splitTip(bad)).toThrow(RangeError);
    }
  });
});

test.describe("capture posting", () => {
  test("a ₹100 tip posts a balanced entry", () => {
    expect(capturePosting(splitTip(10000))).toEqual([
      { account: "processor_clearing", debitPaise: 10000, creditPaise: 0 },
      { account: "creator_payable", debitPaise: 0, creditPaise: 9250 },
      { account: "platform_fee_revenue", debitPaise: 0, creditPaise: 500 },
      { account: "gateway_fee_expense", debitPaise: 0, creditPaise: 250 },
    ]);
  });

  test("never writes a zero line and always balances", () => {
    // 1 paise: both charges round to nothing, so only two lines remain.
    const tiny = capturePosting(splitTip(1));
    expect(tiny.every((l) => l.debitPaise > 0 || l.creditPaise > 0)).toBe(true);
    for (const gross of [1, 2, 9, 10, 100, 12345, 10000000]) {
      const lines = capturePosting(splitTip(gross));
      const d = lines.reduce((s, l) => s + l.debitPaise, 0);
      const c = lines.reduce((s, l) => s + l.creditPaise, 0);
      expect(d).toBe(c);
      expect(lines.every((l) => (l.debitPaise > 0) !== (l.creditPaise > 0))).toBe(true);
    }
  });

  test("fee lines skip zero amounts and carry the rate", () => {
    expect(feeLines(splitTip(10000))).toEqual([
      { feeType: "platform_fee", amountPaise: 500, bps: 500 },
      { feeType: "gateway_fee", amountPaise: 250, bps: 250 },
    ]);
    expect(feeLines(splitTip(1))).toEqual([]);
  });
});

test.describe("database numbers", () => {
  test("parses bigint strings once and refuses anything else", () => {
    expect(toPaise("10000")).toBe(10000);
    expect(toPaise(BigInt(5))).toBe(5);
    expect(toPaise(7)).toBe(7);
    expect(() => toPaise("12.5")).toThrow(RangeError);
    expect(() => toPaise("abc")).toThrow(RangeError);
    expect(() => toPaise("99999999999999999999")).toThrow(RangeError);
  });
});
