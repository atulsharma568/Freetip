import { expect, test } from "@playwright/test";

// The dashboard's Effects picker (the owner's page), shown through the test fixture.

test.describe("the Effects picker", () => {
  test("starts on what is saved, previews a pick at once, and Save waits for a change", async ({ page }) => {
    await page.goto("/dev-fixtures/effects");
    const clutch = page.getByRole("button", { name: /Clutch pulse/ });
    await expect(clutch).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /^No frame/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
    await expect(page.locator(".bfx-clutch")).toHaveCount(1);

    await page.getByRole("button", { name: /Fox-fire/ }).click();
    await expect(page.getByRole("button", { name: /Fox-fire/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".pf-foxfire")).toHaveCount(1);
    await expect(page.locator(".pf-fox")).toHaveCount(3);
    await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();

    await page.getByRole("button", { name: /Rising embers/ }).click();
    await expect(page.locator(".bfx-embers")).toHaveCount(1);
    await expect(page.locator(".bfx-clutch")).toHaveCount(0);
  });

  test("Black Widow is a pick that draws the finished animation over the photo", async ({ page }) => {
    await page.goto("/dev-fixtures/effects");
    await page.getByRole("button", { name: /Black Widow/ }).click();
    await expect(page.getByRole("button", { name: /Black Widow/ })).toHaveAttribute("aria-pressed", "true");
    // The animation itself, or its still when the device asks for less motion; no CSS ring beside it.
    await expect(page.locator(".pf-custom img")).toHaveAttribute("src", /\/decorations\/black-widow(\.poster)?\.webp$/);
    await expect(page.locator(".pf-foxfire")).toHaveCount(0);
    await page.getByRole("button", { name: /^No frame/ }).click();
    await expect(page.locator(".pf-custom")).toHaveCount(0);
  });

  test("every look can be picked and the page does not scroll sideways at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/dev-fixtures/effects");
    for (const label of ["Flame ring", "Pulsing aura", "Slash ring", "Fox-fire", "Sweeping slashes", "Soft glow sweep", "Spider crawl", "Storm", "Neon glitch", "Falling petals", "No effect", "Black Widow"]) {
      await page.getByRole("button", { name: new RegExp(label) }).click();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});
