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

  test("the decoration upload states exactly what can be uploaded", async ({ page }) => {
    await page.goto("/dev-fixtures/effects");
    const rules = page.getByRole("list", { name: "What you can upload" }).nth(1);
    for (const part of ["PNG, GIF or WebP", "Not JPG, not video", "up to 3 MB", "512 × 512 to 4096 × 4096 pixels", "see-through"]) {
      await expect(rules).toContainText(part);
    }
    await expect(page.getByRole("list", { name: "What you can upload" }).first()).toContainText("256 × 256");
  });

  test("saved decorations are listed with the ones the owner shared, and picking one opens the placement controls", async ({ page }) => {
    await page.goto("/dev-fixtures/effects");
    const saved = page.getByRole("group", { name: "Your saved decorations" });
    await expect(saved.getByRole("button", { name: /Wings one/ })).toBeVisible();
    await expect(saved.getByRole("button", { name: /Shared ring/ })).toContainText("Shared with you by @mira");
    // Profile pictures are listed apart from decorations.
    await expect(saved.getByRole("button", { name: /Portrait one/ })).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Your saved pictures" }).getByRole("button", { name: /Portrait one/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save to my tip page" })).toHaveCount(0);
    await saved.getByRole("button", { name: /Wings one/ }).click();
    await expect(page.getByRole("group", { name: "Where it goes on your photo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save to my tip page" })).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Spot on your photo" })).toBeVisible();
    // Around the photo is the default: the old ring, 144 percent of the photo, centred.
    await expect(page.locator(".pf-custom")).toHaveAttribute("style", /inset: -22% auto auto -22%; width: 144%; height: 144%/);
  });

  test("the spot, size and nudge move the decoration on the preview", async ({ page }) => {
    await page.goto("/dev-fixtures/effects");
    await page.getByRole("group", { name: "Your saved decorations" }).getByRole("button", { name: /Wings one/ }).click();
    await page.getByRole("radio", { name: "Top right" }).click();
    // A piece on a corner starts smaller (60 percent): its centre sits on the photo's corner.
    await expect(page.locator(".pf-custom")).toHaveAttribute("style", /inset: -30% auto auto 70%; width: 60%; height: 60%/);
    await page.getByLabel(/^Left or right/).fill("10");
    await expect(page.locator(".pf-custom")).toHaveAttribute("style", /inset: -30% auto auto 80%/);
    await page.getByLabel(/^Size:/).fill("40");
    await expect(page.locator(".pf-custom")).toHaveAttribute("style", /width: 40%; height: 40%/);
    await page.getByRole("button", { name: "Reset position" }).click();
    await expect(page.locator(".pf-custom")).toHaveAttribute("style", /inset: -22% auto auto -22%; width: 144%/);
    await page.getByRole("radio", { name: "Around the photo" }).click();
    await expect(page.getByRole("radio", { name: "Around the photo" })).toHaveAttribute("aria-checked", "true");
  });

  test("the placement controls fit a 320px phone", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/dev-fixtures/effects");
    await page.getByRole("group", { name: "Your saved decorations" }).getByRole("button", { name: /Shared ring/ }).click();
    await page.getByRole("radio", { name: "Bottom left" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    // A shared picture cannot be deleted from here, only taken off the page.
    await expect(page.getByRole("button", { name: "Delete this picture" })).toHaveCount(0);
  });
});
