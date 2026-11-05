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

    await page.getByRole("button", { name: /Falling petals/ }).click();
    await expect(page.getByRole("button", { name: /Falling petals/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".bfx-petals")).toHaveCount(1);
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
    await page.getByRole("button", { name: /^No frame/ }).click();
    await expect(page.locator(".pf-custom")).toHaveCount(0);
  });

  test("an animated profile picture is a pick that plays over the photo, round", async ({ page }) => {
    await page.goto("/dev-fixtures/effects");
    await page.getByRole("button", { name: /Killua/ }).click();
    await expect(page.locator(".pf-custom img")).toHaveAttribute("src", /\/decorations\/killua(\.poster)?\.webp$/);
    await expect(page.locator(".bfx img")).toHaveCount(0);
  });

  test("an animated banner picture is a pick that plays over the banner strip", async ({ page }) => {
    await page.goto("/dev-fixtures/effects");
    await page.getByRole("button", { name: /Sakura/ }).click();
    await expect(page.getByRole("button", { name: /Sakura/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".bfx img")).toHaveAttribute("src", /\/decorations\/sakura(\.poster)?\.webp$/);
    await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  test("every look can be picked and the page does not scroll sideways at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/dev-fixtures/effects");
    for (const label of ["Falling petals", "Rising embers", "Clutch pulse", "Peaky Blinders", "Sakura", "Solo Leveling", "Apple kitty", "Toney", "Eternal", "Fkimgworkkk", "Explosive cat", "Killua", "Angel", "Nanami", "Naoya", "No effect", "Black Widow"]) {
      await page.getByRole("button", { name: new RegExp(label) }).click();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});
