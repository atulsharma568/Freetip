import { expect, test } from "@playwright/test";

test.describe("keyboard and stream controls", () => {
  for (const route of [
    "/",
    "/signup",
    "/signin",
    "/terms",
    "/privacy",
    "/refunds",
    "/delivery",
    "/contact",
    "/pricing",
    "/about",
    "/kabirplays",
  ]) {
    test(`${route} focuses the skip link on the first Tab`, async ({ page, browserName }) => {
      test.skip(
        browserName === "webkit",
        "iPhone WebKit emulation does not expose keyboard Tab traversal",
      );
      await page.goto(route, { waitUntil: "domcontentloaded" });

      await page.keyboard.press("Tab");
      const skipLink = page.getByRole("link", { name: "Skip to content" });

      await expect(skipLink).toBeFocused();
      await expect(skipLink).toHaveAttribute("href", "#main");
    });
  }

  test("stream settings expose and toggle aria-checked state", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const settings = page.locator("#stream");
    await settings.scrollIntoViewIfNeeded();

    for (const id of ["stream-alerts", "stream-tts", "stream-approve"]) {
      const control = settings.locator(`#${id}`);
      await expect(control).toHaveAttribute("aria-checked", "true");
      await control.click();
      await expect(control).toHaveAttribute("aria-checked", "false");
      await control.click();
      await expect(control).toHaveAttribute("aria-checked", "true");
    }
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("renders the complete hero h1 without waiting for animation", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText("Your link.");
  });
});
