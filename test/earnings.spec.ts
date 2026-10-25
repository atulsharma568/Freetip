import { expect, test } from "@playwright/test";
import {
  TIPS_PAGE_SIZE,
  csvCell,
  dailyBars,
  shortDay,
  formatIst,
  tipsCsv,
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

test.describe("tips CSV", () => {
  test("keeps fan-typed formulas as text", () => {
    for (const v of ["=1+1", "+1", "-1", "@SUM(A1)", "\tx", "\rx"]) {
      expect(csvCell(v).replace(/^"/, "").startsWith("'")).toBe(true);
    }
    expect(csvCell("plain")).toBe("plain");
  });

  test("quotes commas, quotes and line breaks", () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("one\ntwo")).toBe('"one\ntwo"');
  });

  test("writes IST times", () => {
    // 18:29Z is 23:59 in India; 18:30Z is the next midnight.
    expect(formatIst(new Date("2026-10-25T18:29:00Z"))).toBe("2026-10-25 23:59");
    expect(formatIst(new Date("2026-10-25T18:30:00Z"))).toBe("2026-10-26 00:00");
  });

  test("rows carry plain amounts and a header", () => {
    const csv = tipsCsv([
      {
        capturedAt: new Date("2026-10-25T18:29:00Z"),
        name: "Asha",
        amountPaise: 10000,
        sharePaise: 9264,
        message: "=cmd, hi",
        messageStatus: "approved",
      },
      {
        capturedAt: new Date("2026-10-25T10:00:00Z"),
        name: "Anonymous",
        amountPaise: 100,
        sharePaise: 93,
        message: null,
        messageStatus: "rejected",
      },
    ]);
    const lines = csv.replace("\uFEFF", "").trimEnd().split("\r\n");
    expect(lines[0]).toBe(
      "Date (IST),Fan,Amount (INR),Estimated share (INR),Message,Message status",
    );
    expect(lines[1]).toBe('2026-10-25 23:59,Asha,100.00,92.64,"\'=cmd, hi",approved');
    expect(lines[2]).toBe("2026-10-25 15:30,Anonymous,1.00,0.93,,rejected");
  });
});

test.describe("daily chart", () => {
  const days = [
    { day: "2026-10-23", grossPaise: 0 },
    { day: "2026-10-24", grossPaise: 100 },
    { day: "2026-10-25", grossPaise: 10000 },
  ];

  test("scales to the busiest day, with a visible minimum and no bar for zero", () => {
    const [zero, small, big] = dailyBars(days, 300, 100);
    expect(zero.height).toBe(0);
    expect(big.height).toBe(100);
    expect(big.y).toBe(0);
    expect(small.height).toBe(3);
    expect(small.y + small.height).toBe(100);
  });

  test("an all-zero or empty range draws nothing and does not break", () => {
    expect(dailyBars(days.map((d) => ({ ...d, grossPaise: 0 })), 300, 100).every((b) => b.height === 0)).toBe(true);
    expect(dailyBars([], 300, 100)).toEqual([]);
  });

  test("bars stay inside their slot", () => {
    for (const b of dailyBars(days, 300, 100)) {
      expect(b.x).toBeGreaterThanOrEqual(b.slotX);
      expect(b.x + b.width).toBeLessThanOrEqual(b.slotX + b.slotWidth);
    }
  });

  test("short day labels do not depend on the time zone", () => {
    expect(shortDay("2026-10-25")).toBe("25 Oct");
    expect(shortDay("2026-01-05")).toBe("5 Jan");
  });
});
