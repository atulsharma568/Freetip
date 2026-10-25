import { expect, test } from "@playwright/test";

// The contact form on /contact. Without a database the server says it is
// unavailable, which is what these tests expect; saving is covered by the
// rules in contact-rules.spec.ts and checked by hand against Neon.
test.describe("contact form", () => {
  const send = (page: import("@playwright/test").Page) =>
    page.getByRole("button", { name: "Send message" });

  test("rejects an invalid email and focuses it", async ({ page }) => {
    await page.goto("/contact", { waitUntil: "networkidle" });
    await page.locator("#contact-name").fill("Asha");
    await page.locator("#contact-email").fill("nope");
    await page.locator("#contact-topic").selectOption("general");
    await page.locator("#contact-message").fill("A question about payouts.");
    await send(page).click();

    await expect(page.locator("#contact-status")).toContainText("valid email");
    await expect(page.locator("#contact-email")).toBeFocused();
  });

  test("asks for a topic", async ({ page }) => {
    await page.goto("/contact", { waitUntil: "networkidle" });
    await page.locator("#contact-name").fill("Asha");
    await page.locator("#contact-email").fill("asha@example.com");
    await page.locator("#contact-message").fill("A question about payouts.");
    await send(page).click();

    await expect(page.locator("#contact-status")).toContainText("Choose what");
  });

  test("the payment reference field appears only for payment problems", async ({ page }) => {
    await page.goto("/contact", { waitUntil: "networkidle" });
    await expect(page.locator("#contact-payment")).toHaveCount(0);
    await page.locator("#contact-topic").selectOption("payment");
    await expect(page.locator("#contact-payment")).toBeVisible();
  });

  test("reports an unavailable form without a database", async ({ page }) => {
    await page.goto("/contact", { waitUntil: "networkidle" });
    await page.locator("#contact-name").fill("Asha");
    await page.locator("#contact-email").fill("asha@example.com");
    await page.locator("#contact-topic").selectOption("general");
    await page.locator("#contact-message").fill("A question about payouts.");
    await send(page).click();

    await expect(page.locator("#contact-status")).toContainText("isn't working");
  });
});
