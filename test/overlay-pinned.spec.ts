import { expect, test } from "@playwright/test";

const TOKEN = "a".repeat(43);
const API = `**/api/overlay/${TOKEN}/pinned`;

const CARD = { id: 11, name: "Riya", amountPaise: 25000, message: "Best stream all year!", secondsLeft: 20 };

// The pinned message overlay for OBS (paid highlighted messages): draws only what the API
// sends, goes away when its time runs out, and never breaks the OBS source.
test.describe("pinned message overlay", () => {
  test("shows the pinned card with name, amount and message", async ({ page }) => {
    await page.route(API, (route) => route.fulfill({ json: { pinned: CARD } }));
    await page.goto(`/overlay/${TOKEN}/pinned`);
    const card = page.getByTestId("pinned-message");
    await expect(card).toBeVisible();
    await expect(card).toContainText("Riya");
    await expect(card).toContainText("₹250");
    await expect(page.getByTestId("pinned-text")).toHaveText("Best stream all year!");
  });

  test("draws nothing while nothing is pinned", async ({ page }) => {
    await page.route(API, (route) => route.fulfill({ json: { pinned: null } }));
    await page.goto(`/overlay/${TOKEN}/pinned`);
    await page.waitForResponse(API);
    await expect(page.getByTestId("pinned-message")).toHaveCount(0);
  });

  test("the card leaves when its time runs out", async ({ page }) => {
    await page.route(API, (route) => route.fulfill({ json: { pinned: { ...CARD, secondsLeft: 2 } } }));
    await page.goto(`/overlay/${TOKEN}/pinned`);
    await expect(page.getByTestId("pinned-message")).toBeVisible();
    await expect(page.getByTestId("pinned-message")).toHaveCount(0, { timeout: 6000 });
  });

  test("a newer message replaces the older one, and an unpin clears the card on the next check", async ({ page }) => {
    const answers = [
      { pinned: CARD },
      { pinned: { ...CARD, id: 12, name: "Kabir", message: "Second one" } },
      { pinned: null },
    ];
    let n = 0;
    await page.route(API, (route) => route.fulfill({ json: answers[Math.min(n++, answers.length - 1)] }));
    await page.goto(`/overlay/${TOKEN}/pinned`);
    await expect(page.getByTestId("pinned-text")).toHaveText("Best stream all year!");
    await expect(page.getByTestId("pinned-text")).toHaveText("Second one", { timeout: 8000 });
    await expect(page.getByTestId("pinned-message")).toHaveCount(0, { timeout: 8000 });
  });

  test("a network blip keeps the card on screen", async ({ page }) => {
    let n = 0;
    await page.route(API, (route) => (n++ === 0 ? route.fulfill({ json: { pinned: CARD } }) : route.abort()));
    await page.goto(`/overlay/${TOKEN}/pinned`);
    await expect(page.getByTestId("pinned-message")).toBeVisible();
    await page.waitForTimeout(3600);
    await expect(page.getByTestId("pinned-message")).toBeVisible();
  });

  test("the page has no site chrome and is kept out of search results", async ({ page }) => {
    await page.route(API, (route) => route.fulfill({ json: { pinned: null } }));
    await page.goto(`/overlay/${TOKEN}/pinned`);
    await expect(page.locator("nav, footer")).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("the API rejects a bad token and never caches", async ({ request }) => {
    const bad = await request.get("/api/overlay/not-a-token/pinned");
    expect(bad.status()).toBe(404);
    // No database on the test server: 503, and never cached.
    const res = await request.get(`/api/overlay/${TOKEN}/pinned`);
    expect([404, 503]).toContain(res.status());
    expect(res.headers()["cache-control"]).toBe("no-store");
  });
});
