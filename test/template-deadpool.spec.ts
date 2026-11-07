import { expect, test } from "@playwright/test";

// The "Deadpool" look template (dashboard Effects, components/tip/DeadpoolDecor.tsx), through the fixtures.

test.describe("the Deadpool template", () => {
  test("the tip page draws ring, banner, nameplate, effect and frame, and keeps the name as the one h1", async ({ page }) => {
    await page.goto("/dev-fixtures/tip?page=default&template=deadpool");
    for (const sel of [".dp-ring", ".dp-banner", ".dp-plate", ".dp-card"]) await expect(page.locator(sel)).toHaveCount(1);
    // The creator card and the form card each have a frame and an effect layer.
    await expect(page.locator(".dp-frame")).toHaveCount(2);
    await expect(page.locator(".dp-fx")).toHaveCount(1);
    await expect(page.locator(".dp-plate")).toHaveCount(1);
    await expect(page.locator(".dp-banner")).toHaveCount(1);
    // Each frame has its two eyes; the ring has its metal and its katana; the effect has embers and slashes.
    await expect(page.locator(".dp-eye")).toHaveCount(4);
    // The payment controls are still the real ones, inside the dressed-up card.
    await expect(page.locator(".dp-card").getByRole("button", { name: /^Tip/ })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sample Creator");
    // Decoration only: nothing in it is read out or clickable.
    for (const el of await page.locator(".dp-ring, .dp-fx").all()) await expect(el).toHaveAttribute("aria-hidden", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test("the classic page has none of it", async ({ page }) => {
    await page.goto("/dev-fixtures/tip?page=default");
    await expect(page.locator(".dp-frame, .dp-plate, .dp-ring")).toHaveCount(0);
  });

  test("the owner's signature name sits on the plate without leaving the column", async ({ page }) => {
    await page.goto("/dev-fixtures/tip?page=owner&template=deadpool");
    const plate = await page.locator(".dp-plate").boundingBox();
    const panel = await page.locator(".dp-frame").first().boundingBox();
    expect(plate && panel && plate.x + plate.width <= panel.x + panel.width).toBe(true);
  });

  test("with reduced motion the marks stay hidden and nothing is animated", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 320, height: 800 } });
    const page = await ctx.newPage();
    await page.goto("/dev-fixtures/tip?page=default&template=deadpool");
    for (const sel of [".dp-sheen", ".dp-beams"]) {
      expect(await page.locator(sel).first().evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await ctx.close();
  });

  test("the Pay button wiggles once it can be pressed, and not with reduced motion", async ({ page, browser }) => {
    await page.goto("/dev-fixtures/tip?page=default&template=deadpool");
    const pay = page.locator(".dp-card .beam");
    await expect(pay).toBeDisabled();
    expect(await pay.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    await page.getByRole("checkbox", { name: /I understand/ }).check();
    await expect(pay).toBeEnabled();
    expect(await pay.evaluate((el) => getComputedStyle(el).animationName)).toBe("dp-ready");
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const calm = await ctx.newPage();
    await calm.goto("/dev-fixtures/tip?page=default&template=deadpool");
    await calm.getByRole("checkbox", { name: /I understand/ }).check();
    expect(await calm.locator(".dp-card .beam").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    await ctx.close();
  });

  test("the Effects picker offers Classic and Deadpool, and Deadpool shows on its preview", async ({ page }) => {
    await page.goto("/dev-fixtures/effects");
    await expect(page.getByRole("button", { name: /^Classic/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".dp-frame")).toHaveCount(0);
  });
});
