import { expect, test } from "@playwright/test";
import { checkGoal, goalPercent, parseRepeat, periodStart } from "../src/lib/goal";

const TOKEN = "a".repeat(43);

test.describe("goal bar", () => {
  test("checkGoal cleans the name and needs a whole rupee target", () => {
    expect(checkGoal("  New   mic ", "5,000")).toEqual({ ok: true, title: "New mic", targetPaise: 500000 });
    expect(checkGoal("", "500").ok).toBe(false);
    expect(checkGoal("Mic", "5.5").ok).toBe(false);
    expect(checkGoal("Mic", "9").ok).toBe(false);
    expect(checkGoal("Mic", "abc").ok).toBe(false);
  });

  test("repeating goals reset at midnight India time, weeks on Monday", () => {
    // Wed 5 Nov 2026 10:00 IST = 04:30 UTC.
    const now = new Date("2026-11-05T04:30:00Z");
    expect(periodStart("daily", now).toISOString()).toBe("2026-11-04T18:30:00.000Z");
    expect(periodStart("weekly", now).toISOString()).toBe("2026-11-01T18:30:00.000Z"); // Mon 2 Nov 00:00 IST
    expect(periodStart("monthly", now).toISOString()).toBe("2026-10-31T18:30:00.000Z");
    expect(periodStart("weekly", now, 1).toISOString()).toBe("2026-10-25T18:30:00.000Z");
    expect(periodStart("monthly", now, 1).toISOString()).toBe("2026-09-30T18:30:00.000Z");
    // 23:00 UTC on Sunday 1 Nov is already Monday 04:30 IST: a new week.
    expect(periodStart("weekly", new Date("2026-11-01T23:00:00Z")).toISOString()).toBe("2026-11-01T18:30:00.000Z");
    // Early January steps back across the year.
    expect(periodStart("monthly", new Date("2027-01-10T00:00:00Z"), 1).toISOString()).toBe("2026-11-30T18:30:00.000Z");
    expect(parseRepeat("weekly")).toBe("weekly");
    expect(parseRepeat("yearly")).toBe("never");
  });

  test("goalPercent stays between 0 and 100", () => {
    expect(goalPercent(0, 1000)).toBe(0);
    expect(goalPercent(250, 1000)).toBe(25);
    expect(goalPercent(5000, 1000)).toBe(100);
    expect(goalPercent(10, 0)).toBe(0);
  });

  test("the bar shows the title, amounts and progress from the API", async ({ page }) => {
    await page.route(`**/api/overlay/${TOKEN}/goal`, (route) =>
      route.fulfill({ json: { goal: { title: "New mic", targetPaise: 500000, raisedPaise: 125000 } } }),
    );
    await page.goto(`/overlay/${TOKEN}/goal`);
    const bar = page.getByTestId("goal-bar");
    await expect(bar).toContainText("New mic");
    await expect(bar).toContainText("₹1,250 / ₹5,000");
    await expect(bar.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
  });

  test("no goal shows nothing, and a bad token is a 404", async ({ page, request }) => {
    await page.route(`**/api/overlay/${TOKEN}/goal`, (route) => route.fulfill({ json: { goal: null } }));
    await page.goto(`/overlay/${TOKEN}/goal`);
    await page.waitForTimeout(500);
    await expect(page.getByTestId("goal-bar")).toHaveCount(0);
    expect((await request.get("/api/overlay/nope/goal")).status()).toBe(404);
    expect((await request.get(`/api/overlay/${TOKEN}/goal`)).status()).toBe(503);
  });
});
