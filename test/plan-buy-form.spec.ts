import { expect, test } from "@playwright/test";

// The Buy form in a real browser, on the test-only fixture page (made-up prices). The payment
// itself is never reached: the form's action needs a signed-in creator and the test server has none,
// so pressing Pay shows the sign-in message. What is checked here is the form: what turns the
// button on, what it says, and that it fits a 320 px screen.

const PHONE = /Your mobile number/;

test.describe("the Buy form", () => {
  test("the Pay button needs a mobile number and the tick, and says the price of the chosen term", async ({ page }) => {
    await page.goto("/dev-fixtures/plans");
    const pay = page.getByRole("button", { name: /^Pay / });
    await expect(pay).toBeDisabled();
    await expect(pay).toHaveText("Pay ₹299 with PayU");

    await page.getByLabel(PHONE).fill("98765");
    await page.getByRole("checkbox").check();
    await expect(pay).toBeDisabled(); // number still too short

    await page.getByLabel(PHONE).fill("98765 43210");
    await expect(pay).toBeEnabled();

    await page.getByRole("radio", { name: /12 months/ }).check({ force: true });
    await expect(pay).toHaveText("Pay ₹2,499 with PayU");

    await page.getByRole("checkbox").uncheck();
    await expect(pay).toBeDisabled();
  });

  test("shows the early price and the renewing wording when they apply", async ({ page }) => {
    await page.goto("/dev-fixtures/plans?early=1&renewing=1");
    await expect(page.getByText("Add another term")).toBeVisible();
    await expect(page.getByText("Early price").first()).toBeVisible();
    await expect(page.getByText("₹149 for 1 month")).toBeVisible();
    await expect(page.getByText("A new term starts when your current one ends")).toBeVisible();
  });

  test("pressing Pay without a signed-in creator shows a plain message and turns the button back on", async ({ page }) => {
    await page.goto("/dev-fixtures/plans");
    await page.getByLabel(PHONE).fill("9876543210");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /^Pay / }).click();
    await expect(page.getByText("Sign in again to buy paid features.")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Pay / })).toBeEnabled();
    // Nothing was sent to PayU.
    expect(page.url()).toContain("/dev-fixtures/plans");
  });

  test("says why the mobile number is asked and that it is not kept, and links the terms and refund policy", async ({ page }) => {
    await page.goto("/dev-fixtures/plans");
    await expect(page.getByText("We pass it to PayU and do not keep it.")).toBeVisible();
    const form = page.locator("form");
    await expect(form.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    await expect(form.getByRole("link", { name: "Refund Policy" })).toHaveAttribute("href", "/refunds");
  });

  test("the payment messages read plainly", async ({ page }) => {
    for (const [notice, text] of [
      ["paid", "Payment received."],
      ["pending", "We are waiting for PayU"],
      ["failed", "The payment did not go through."],
      ["cancelled", "You cancelled the payment"],
    ] as const) {
      await page.goto(`/dev-fixtures/plans?notice=${notice}`);
      await expect(page.getByText(text)).toBeVisible();
    }
  });

  test("the plan cards show month prices, switch to year prices, and cannot be bought yet", async ({ page }) => {
    await page.goto("/dev-fixtures/plans");
    const cards = page.getByRole("article");
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toContainText("Starter");
    await expect(cards.nth(0)).toContainText("₹149");
    await expect(cards.nth(1)).toContainText("Everything in Starter, plus");
    await expect(cards.nth(1)).toContainText("₹299");

    await page.getByRole("button", { name: "12 months" }).click();
    await expect(cards.nth(0)).toContainText("₹1,199 a year");
    await expect(cards.nth(1)).toContainText("₹2,499 a year");
    await expect(cards.nth(1)).toContainText("save 30%");
    await expect(cards.nth(1)).toContainText("₹1,299"); // the early price for a year

    await expect(page.getByRole("button", { name: "Buying opens soon" })).toHaveCount(2);
    for (const b of await page.getByRole("button", { name: "Buying opens soon" }).all()) await expect(b).toBeDisabled();
    await expect(cards.nth(2)).toContainText("From ₹2,999");
    await expect(cards.nth(2).getByRole("link", { name: "Ask about it" })).toHaveAttribute("href", "/contact#message");
  });

  for (const width of [320, 390]) {
    test(`fits a ${width}px screen with no sideways scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/dev-fixtures/plans?early=1&renewing=1&notice=pending");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
