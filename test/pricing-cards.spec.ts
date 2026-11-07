import { expect, test } from "@playwright/test";

// The three plan cards at the top of /pricing. Sales are closed in the test build (LIVE_SALES_OPEN
// is false), so the paid cards say "Soon" and the billing switch is not there.

test.describe("pricing cards", () => {
  test("three cards: Starter, Creator (featured) and the custom page", async ({ page }) => {
    await page.goto("/pricing");
    const plans = page.locator("#plans");
    await expect(plans.getByRole("heading", { level: 3 })).toHaveText(["Starter", "Creator", "Custom page"]);
    await expect(plans.getByText("Most complete")).toBeVisible();
    await expect(plans.getByText("From ₹2,999")).toBeVisible();
  });

  test("while sales are closed no price is shown and there is no billing switch", async ({ page }) => {
    await page.goto("/pricing");
    const plans = page.locator("#plans");
    await expect(plans.getByText("Soon")).toHaveCount(2);
    await expect(plans.getByRole("radiogroup")).toHaveCount(0);
    await expect(plans.getByText("₹199")).toHaveCount(0);
    await expect(plans.getByText("₹399")).toHaveCount(0);
  });

  test("buttons go to sign up and contact, and the page does not scroll sideways", async ({ page }) => {
    await page.goto("/pricing");
    const plans = page.locator("#plans");
    await expect(plans.getByRole("link", { name: "Get started free" }).first()).toHaveAttribute("href", "/signup");
    await expect(plans.getByRole("link", { name: "Ask for a custom page" })).toHaveAttribute("href", "/contact");
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(wide).toBe(false);
  });

  test("the legal sections are still below the cards", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: /What creators pay/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Optional paid features/ })).toBeVisible();
  });
});
