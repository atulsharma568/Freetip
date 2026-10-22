import { expect, test } from "@playwright/test";

const publicRoutes = [
  "/",
  "/signup",
  "/signin",
  "/terms",
  "/privacy",
  "/refunds",
  "/delivery",
  "/contact",
  "/pricing",
  "/about",
];

test.describe("public routes", () => {
  for (const route of publicRoutes) {
    test(`${route} returns 200 with one visible h1`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });

      expect(response?.status()).toBe(200);
      const heading = page.getByRole("heading", { level: 1 });
      await expect(heading).toHaveCount(1);
      await expect(heading).toBeVisible();
    });
  }

  test("/kabirplays returns the creator-link 404 page", async ({ page }) => {
    const response = await page.goto("/kabirplays", {
      waitUntil: "domcontentloaded",
    });

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "This page doesn't exist.",
    );
    await expect(page.getByRole("link", { name: "Join the waitlist" })).toHaveAttribute(
      "href",
      "/signup",
    );
    await expect(
      page.locator("#main").getByRole("link", { name: "Back to home" }),
    ).toHaveAttribute("href", "/");
  });
});

test.describe("owner routes", () => {
  test("unauthenticated owner access redirects to sign-in", async ({ request }) => {
    const response = await request.get("/admin", { maxRedirects: 0 });

    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe("/signin");
  });
});
