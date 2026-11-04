import { expect, test } from "@playwright/test";
import { TIER_PRICES } from "../src/lib/pricing";

// The plan cards and the Buy form in a real browser, on the test-only fixture page (made-up quotes).
// The payment itself is never reached: the form's action needs a signed-in creator and the test
// server has none, so pressing Pay shows the sign-in message. What is checked here is the cards and
// the form: what turns the button on, what it says, and that it fits a 320 px screen.

const PHONE = /Your mobile number/;
// Prices are read from the one place they are set, so changing them there does not break these checks.
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const S = TIER_PRICES.starter;
const C = TIER_PRICES.creator;

test.describe("the plan cards", () => {
  test("show month prices, switch to year prices, and offer the early price only when a seat is left", async ({ page }) => {
    await page.goto("/dev-fixtures/plans");
    const cards = page.getByRole("article");
    await expect(cards).toHaveCount(2); // the two plans; every feature is in the table under them
    await expect(cards.nth(0)).toContainText("Starter");
    await expect(cards.nth(0)).toContainText(inr(S.monthly));
    await expect(cards.nth(1)).toContainText("Everything in Starter, plus");
    await expect(cards.nth(1)).toContainText(inr(C.monthly));
    // No early seat is left in this view, so the line is not shown.
    await expect(cards.nth(1)).not.toContainText("Early price");

    await page.getByRole("button", { name: "12 months" }).click();
    await expect(cards.nth(0)).toContainText(`${inr(S.yearly)} a year`);
    await expect(cards.nth(1)).toContainText(`${inr(C.yearly)} a year`);
    await expect(cards.nth(1)).toContainText(`save ${Math.round((1 - C.yearly / (C.monthly * 12)) * 100)}%`);

    // The one-time extras sit under the table, with their prices and a link to ask.
    const extras = page.getByRole("region", { name: "One-time extras" });
    await expect(extras).toContainText(`From ${inr(TIER_PRICES.customFrom)}`);
    await expect(extras.getByRole("link", { name: "Ask about an extra" })).toHaveAttribute("href", "/contact#message");

    await page.goto("/dev-fixtures/plans?early=1");
    await expect(page.getByRole("article").nth(1)).toContainText("Early price for the first 50 creators");
    await expect(page.getByRole("article").nth(1)).toContainText(inr(C.early.monthly));
    await page.getByRole("button", { name: "12 months" }).click();
    await expect(page.getByRole("article").nth(1)).toContainText(inr(C.early.yearly));
  });

  test("the table names every feature, marks the Creator-only groups and never says 'and N more'", async ({ page }) => {
    await page.goto("/dev-fixtures/plans?on=1");
    await expect(page.getByText(/and \d+ more/)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Every feature, side by side" })).toBeVisible();
    for (const name of ["Alert looks", "Stream overlays", "Stream moments", "Your own media", "Your voice", "Your fans", "Your workflow"]) {
      await expect(page.getByRole("heading", { name, level: 3 })).toBeVisible();
    }
    await expect(page.getByText("Only in Creator.").first()).toBeVisible();
    await expect(page.getByText("Your own GIFs, pictures and clips")).toBeVisible();
    await expect(page.getByText("Voices in more Indian languages")).toBeVisible();
    // A feature switched on for the creator says so; a hand-ticked one the plans do not sell shows apart.
    await expect(page.getByText("On for you").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Switched on for you by hand" })).toBeVisible();
    await expect(page.getByText("A custom tip page")).toBeVisible();
  });

  test("a plan that cannot be bought yet has an off button and no pay form", async ({ page }) => {
    await page.goto("/dev-fixtures/plans?buy=off");
    await expect(page.getByRole("button", { name: "Buying opens soon" })).toHaveCount(2);
    for (const b of await page.getByRole("button", { name: "Buying opens soon" }).all()) await expect(b).toBeDisabled();
    await expect(page.getByLabel(PHONE)).toHaveCount(0);
    await expect(page.getByText("Early price for the first 50 creators").first()).toBeVisible();
  });
});

test.describe("the Buy form", () => {
  test("opens for the chosen plan, says the price of the chosen term, and needs a number and the tick", async ({ page }) => {
    await page.goto("/dev-fixtures/plans");
    await expect(page.getByLabel(PHONE)).toHaveCount(0); // nothing until a plan is chosen
    await page.getByRole("button", { name: "Choose Creator" }).click();
    await expect(page.getByRole("heading", { name: "Buy Creator" })).toBeVisible();
    const pay = page.getByRole("button", { name: /^Pay / });
    await expect(pay).toBeDisabled();
    await expect(pay).toHaveText(`Pay ${inr(C.monthly)} with PayU`);

    await page.getByLabel(PHONE).fill("98765");
    await page.getByRole("checkbox").check();
    await expect(pay).toBeDisabled(); // number still too short

    await page.getByLabel(PHONE).fill("98765 43210");
    await expect(pay).toBeEnabled();

    // The switch above the cards changes the term; the number and the tick stay.
    await page.getByRole("button", { name: "12 months" }).first().click();
    await expect(pay).toHaveText(`Pay ${inr(C.yearly)} with PayU`);
    await expect(pay).toBeEnabled();
    await expect(page.getByLabel(PHONE)).toHaveValue("98765 43210");
    await expect(page.getByRole("checkbox")).toBeChecked();

    // Choosing the other plan changes the amount and the heading, and keeps what was typed.
    await page.getByRole("button", { name: "Choose Starter" }).click();
    await expect(page.getByRole("heading", { name: "Buy Starter" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Pay / })).toHaveText(`Pay ${inr(S.yearly)} with PayU`);
    await expect(page.getByLabel(PHONE)).toHaveValue("98765 43210");
    await expect(page.getByRole("checkbox")).toBeChecked();
    await expect(page.getByRole("button", { name: /^Pay / })).toBeEnabled();

    await page.getByRole("checkbox").uncheck();
    await expect(page.getByRole("button", { name: /^Pay / })).toBeDisabled();
  });

  test("the term switch inside the form is the same choice as the one above the cards", async ({ page }) => {
    await page.goto("/dev-fixtures/plans");
    await page.getByRole("button", { name: "Choose Creator" }).click();
    await expect(page.getByRole("button", { name: /^Pay / })).toHaveText(`Pay ${inr(C.monthly)} with PayU`);
    // Two switches now: the one above the cards and the one in the form.
    const switches = page.getByRole("button", { name: "12 months" });
    await expect(switches).toHaveCount(2);
    await switches.nth(1).click();
    await expect(page.getByRole("button", { name: /^Pay / })).toHaveText(`Pay ${inr(C.yearly)} with PayU`);
    await expect(page.getByRole("article").nth(1)).toContainText(`${inr(C.yearly)} a year`);
  });

  test("a Starter term a running Creator pass already covers says so and cannot be paid; a longer term can", async ({ page }) => {
    await page.goto("/dev-fixtures/plans?covered=1");
    await page.getByRole("button", { name: "Choose Starter" }).click();
    await page.getByLabel(PHONE).fill("9876543210");
    await page.getByRole("checkbox").check();
    await expect(page.getByText("Your Creator plan already includes everything in Starter for this long")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Pay / })).toBeDisabled();
    await page.getByRole("button", { name: "12 months" }).first().click();
    await expect(page.getByText("Your Creator plan already includes everything in Starter")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Pay / })).toBeEnabled();
  });

  test("shows the early price and the renewing wording when they apply", async ({ page }) => {
    await page.goto("/dev-fixtures/plans?early=1&renewing=1");
    await expect(page.getByText("Your Starter plan runs until")).toBeVisible();
    await page.getByRole("button", { name: "Add a term of Creator" }).click();
    await expect(page.getByRole("heading", { name: "Add another term of Creator" })).toBeVisible();
    await expect(page.getByText("· Early price")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Pay / })).toHaveText(`Pay ${inr(C.early.monthly)} with PayU`);
    await expect(page.getByText("A new term starts when your current one ends")).toBeVisible();
  });

  test("pressing Pay without a signed-in creator shows a plain message and turns the button back on", async ({ page }) => {
    await page.goto("/dev-fixtures/plans");
    await page.getByRole("button", { name: "Choose Creator" }).click();
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
    await page.getByRole("button", { name: "Choose Starter" }).click();
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
    await page.goto("/dev-fixtures/plans?notice=paid");
    await expect(page.getByText("Your Creator plan is on until")).toBeVisible();
  });

  for (const width of [320, 390]) {
    test(`fits a ${width}px screen with no sideways scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/dev-fixtures/plans?early=1&renewing=1&notice=pending");
      await page.getByRole("button", { name: "Add a term of Creator" }).click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
