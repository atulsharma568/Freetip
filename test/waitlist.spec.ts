import { expect, test, type Page } from "@playwright/test";

test.describe("waitlist validation", () => {
  async function openForm(page: Page, path: string) {
    await page.goto(path, { waitUntil: "networkidle" });
  }

  test("signup rejects an invalid email before saving", async ({ page }) => {
    await openForm(page, "/signup");

    const email = page.locator("#signup-email");
    await email.fill("nope");
    await page.getByRole("button", { name: "Join the waitlist" }).click();

    await expect(page.locator("#signup-status")).toHaveText("Enter a valid email address.");
    await expect(email).toBeFocused();
  });

  test("signup rejects a non-YouTube channel link and focuses the channel field", async ({ page }) => {
    await openForm(page, "/signup");

    await page.locator("#signup-email").fill("qa@example.com");
    const channel = page.locator("#signup-channel");
    await channel.fill("twitter.com/x");
    await page.getByRole("button", { name: "Join the waitlist" }).click();

    await expect(page.locator("#signup-status")).toHaveText(
      "Use your YouTube channel link, like youtube.com/@yourchannel.",
    );
    await expect(channel).toBeFocused();
  });

  test("signup handle filters characters while typing", async ({ page }) => {
    await openForm(page, "/signup");

    const handle = page.locator("#signup-handle");
    await handle.fill("Bad Name!");
    await expect(handle).toHaveValue("badname");
  });

  test("signup reports an unavailable waitlist without a database", async ({ page }) => {
    await openForm(page, "/signup");

    await page.locator("#signup-email").fill("qa@example.com");
    await page.getByRole("button", { name: "Join the waitlist" }).click();

    await expect(page.locator("#signup-status")).toHaveText(
      "The waitlist isn't working right now. Please try again later.",
    );
  });

  test("home waitlist rejects an invalid email", async ({ page }) => {
    await openForm(page, "/");

    const email = page.locator("#waitlist-email");
    await email.fill("nope");
    await page.locator("#claim").getByRole("button", { name: "Join the waitlist" }).click();

    await expect(page.locator("#waitlist-status")).toHaveText("Enter a valid email address.");
    await expect(email).toBeFocused();
  });
});
