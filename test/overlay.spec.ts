import { expect, test } from "@playwright/test";

const TOKEN = "a".repeat(43);

test.describe("OBS overlay routes", () => {
  test("preview plays a sample alert and switches to the vertical layout", async ({ page }) => {
    await page.goto("/overlay/preview");
    const stage = page.getByTestId("preview-stage");
    await expect(stage.getByRole("status")).toContainText("Riya");
    await expect(stage.getByRole("status")).toContainText("₹250");

    await page.getByRole("button", { name: /Vertical/ }).click();
    await expect(stage.locator(".ov-portrait")).toHaveCount(1);
    await expect(stage.getByRole("status")).toContainText("Riya");
  });

  test("live overlay page has no site chrome and a transparent background", async ({ page }) => {
    await page.goto(`/overlay/${TOKEN}`);
    await expect(page.locator("footer")).toHaveCount(0);
    await expect(page.locator("header")).toHaveCount(0);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgba(0, 0, 0, 0)");
  });

  test("a malformed token is a 404 page and a 404 from the API", async ({ page, request }) => {
    const res = await page.goto("/overlay/not-a-real-token");
    expect(res?.status()).toBe(404);
    expect((await request.get("/api/overlay/not-a-real-token")).status()).toBe(404);
  });

  test("the API answers 503 without a database and never caches", async ({ request }) => {
    const res = await request.get(`/api/overlay/${TOKEN}`);
    expect(res.status()).toBe(503);
    expect(res.headers()["cache-control"]).toBe("no-store");
  });

  test("overlay pages are kept out of search results", async ({ page }) => {
    await page.goto(`/overlay/${TOKEN}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});
