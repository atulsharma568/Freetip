import { expect, test } from "@playwright/test";
import {
  TIPS_PAGE_SIZE,
  estimateShare,
  formatRupees,
  parseTipsQuery,
  tipsHref,
} from "../src/lib/earnings";

test.describe("estimated creator share", () => {
  test("a ₹100 tip leaves ₹92.64, the published example", () => {
    expect(estimateShare(10000)).toBe(9264);
  });

  test("rounds each charge to the paise, half up", () => {
    // 1250 paise: 5% is 62.5 -> 63 and 2.36% is 29.5 -> 30, so 1157 stays.
    expect(estimateShare(1250)).toBe(1157);
  });

  test("never exceeds the tip and handles the minimum", () => {
    expect(estimateShare(100)).toBeLessThan(100);
    expect(estimateShare(100)).toBeGreaterThan(0);
  });

  test("formats rupees with Indian digit grouping", () => {
    expect(formatRupees(9264)).toBe("₹92.64");
    expect(formatRupees(12345600)).toBe("₹1,23,456.00");
    expect(formatRupees(0)).toBe("₹0.00");
  });
});

test.describe("tips page address", () => {
  test("defaults to all time, page 1, no message filter", () => {
    expect(parseTipsQuery({})).toEqual({ range: "all", messageOnly: false, page: 1 });
  });

  test("reads a valid range, filter and page", () => {
    expect(parseTipsQuery({ range: "7d", msg: "1", page: "3" })).toEqual({
      range: "7d",
      messageOnly: true,
      page: 3,
    });
  });

  test("ignores junk instead of failing", () => {
    expect(parseTipsQuery({ range: "1y", msg: "yes", page: "-4" })).toEqual({
      range: "all",
      messageOnly: false,
      page: 1,
    });
    expect(parseTipsQuery({ page: "0" }).page).toBe(1);
    expect(parseTipsQuery({ page: "99999" }).page).toBe(1);
    expect(parseTipsQuery({ page: "1e3" }).page).toBe(1);
    expect(parseTipsQuery({ range: ["30d", "7d"] }).range).toBe("30d");
  });

  test("builds short addresses that parse back the same", () => {
    expect(tipsHref({ range: "all", messageOnly: false, page: 1 })).toBe("/dashboard/tips");
    const q = { range: "30d", messageOnly: true, page: 2 } as const;
    const href = tipsHref(q);
    expect(href).toBe("/dashboard/tips?range=30d&msg=1&page=2");
    const params = Object.fromEntries(new URL(href, "http://x").searchParams);
    expect(parseTipsQuery(params)).toEqual(q);
  });

  test("page size is a sensible number", () => {
    expect(TIPS_PAGE_SIZE).toBeGreaterThan(0);
    expect(TIPS_PAGE_SIZE).toBeLessThanOrEqual(50);
  });
});
