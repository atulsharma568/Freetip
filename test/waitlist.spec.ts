import { expect, test, type Page } from "@playwright/test";

// The waitlist form is the closing section of the home page. /signup is the
// Google sign-up page and no longer holds a form; the channel field was
// dropped from the form, and its rules stay covered in waitlist-rules.spec.ts.
test.describe("waitlist validation", () => {
  async function openHome(page: Page) {
    await page.goto("/", { waitUntil: "networkidle" });
  }

  const join = (page: Page) =>
    page.locator("#claim").getByRole("button", { name: "Join the waitlist" });

  test("home waitlist rejects an invalid email", async ({ page }) => {
    await openHome(page);

    const email = page.locator("#waitlist-email");
    await email.fill("nope");
    await join(page).click();

    await expect(page.locator("#waitlist-status")).toHaveText("Enter a valid email address.");
    await expect(email).toBeFocused();
  });

  test("home waitlist handle filters characters while typing", async ({ page }) => {
    await openHome(page);

    const handle = page.locator("#handle");
    await handle.fill("Bad Name!");
    await expect(handle).toHaveValue("badname");
  });

  test("home waitlist reports an unavailable waitlist without a database", async ({ page }) => {
    await openHome(page);

    await page.locator("#waitlist-email").fill("qa@example.com");
    await join(page).click();

    await expect(page.locator("#waitlist-status")).toHaveText(
      "The waitlist isn't working right now. Please try again later.",
    );
  });

  test("signup offers Google sign-up and links to the terms and privacy policy", async ({ page }) => {
    await page.goto("/signup", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { level: 1, name: "Get early access" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    const consent = page.getByText("By continuing, you agree to our");
    await expect(consent.getByRole("link", { name: "terms" })).toHaveAttribute("href", "/terms");
    await expect(consent.getByRole("link", { name: "privacy policy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });
});
