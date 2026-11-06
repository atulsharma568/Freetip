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
    // The frame is a separate pick: with a profile picture and the widow frame both on, two layers are drawn.
    await page.getByRole("button", { name: /Black Widow/ }).click();
    await expect(page.locator(".pf-custom")).toHaveCount(2);
    await page.getByRole("button", { name: /Your own photo/ }).click();
    await expect(page.locator(".pf-custom")).toHaveCount(1);
  });

  test("an animated banner picture is a pick that plays over the banner strip", async ({ page }) => {
    await page.goto("/dev-fixtures/effects");
    await page.getByRole("button", { name: /Sakura/ }).click();
    await expect(page.getByRole("button", { name: /Sakura/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".bfx img")).toHaveAttribute("src", /\/decorations\/sakura(\.poster)?\.webp$/);
    await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  test("an effect and an animated banner picture play together, each saved on its own", async ({ page }) => {
    await page.goto("/dev-fixtures/effects");
    await page.getByRole("button", { name: /Sakura/ }).click();
    await page.getByRole("button", { name: /Falling petals/ }).click();
    // Both stay picked: the picture is the background and the effect plays on top of it.
    await expect(page.getByRole("button", { name: /Sakura/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /Falling petals/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".bfx img")).toHaveAttribute("src", /\/decorations\/sakura(\.poster)?\.webp$/);
    await expect(page.locator(".bfx-petals")).toHaveCount(1);
    // Taking the picture away leaves the effect, and the other way round.
    await page.getByRole("button", { name: /No banner picture/ }).click();
    await expect(page.locator(".bfx img")).toHaveCount(0);
    await expect(page.locator(".bfx-petals")).toHaveCount(1);
    await page.getByRole("button", { name: /Sakura/ }).click();
    await page.getByRole("button", { name: /No effect/ }).click();
    await expect(page.locator(".bfx-petals")).toHaveCount(0);
    await expect(page.locator(".bfx img")).toHaveCount(1);
  });

  test("the upload buttons are there for the profile picture, the decoration and the banner", async ({ page }) => {
    await page.goto("/dev-fixtures/effects");
    await expect(page.getByText("Upload your own picture")).toBeVisible();
    await expect(page.getByText("Upload your own decoration")).toBeVisible();
    // The fixture has the banner switch off and no upload store, so the banner says so and nothing is offered.
    await expect(page.getByText(/not switched on for your account/)).toBeVisible();
  });

  test("every look can be picked and the page does not scroll sideways at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/dev-fixtures/effects");
    for (const label of ["Falling petals", "Rising embers", "Clutch pulse", "Peaky Blinders", "Sakura", "Solo Leveling", "Apple kitty", "Toney", "Eternal", "Fkimgworkkk", "Explosive cat", "Killua", "Angel", "Nanami", "Naoya", "No effect", "No banner picture", "Black Widow"]) {
      await page.getByRole("button", { name: new RegExp(label) }).click();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});
