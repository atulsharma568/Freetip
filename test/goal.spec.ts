import { expect, test } from "@playwright/test";
import { checkGoal, goalPercent } from "../src/lib/goal";

const TOKEN = "a".repeat(43);

test.describe("goal bar", () => {
  test("checkGoal cleans the name and needs a whole rupee target", () => {
    expect(checkGoal("  New   mic ", "5,000")).toEqual({ ok: true, title: "New mic", targetPaise: 500000 });
    expect(checkGoal("", "500").ok).toBe(false);
    expect(checkGoal("Mic", "5.5").ok).toBe(false);
    expect(checkGoal("Mic", "9").ok).toBe(false);
    expect(checkGoal("Mic", "abc").ok).toBe(false);
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
