import { expect, test } from "@playwright/test";

const publicRoutes = [
  "/",
  "/signup",
  "/signin",
  "/terms",
  "/privacy",
  "/refunds",
  "/delivery",
  "/community-guidelines",
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

test.describe("creator dashboard routes", () => {
  test("the tips page redirects signed-out visitors to sign-in", async ({ request }) => {
    const response = await request.get("/dashboard/tips?range=7d", { maxRedirects: 0 });

    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe("/signin");
  });

  test("the recap page redirects signed-out visitors to sign-in", async ({ request }) => {
    const response = await request.get("/dashboard/recap", { maxRedirects: 0 });

    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe("/signin");
  });

  test("the Streamlabs page and its sign-in routes send signed-out visitors to sign-in", async ({ request }) => {
    for (const path of ["/dashboard/streamlabs", "/api/streamlabs/start", "/api/streamlabs/callback?code=x&state=y"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(307);
      expect(response.headers().location, path).toMatch(/\/signin$/);
    }
  });

  test("the paid features page and the pages that can remove stored data send signed-out visitors to sign-in", async ({ request }) => {
    for (const path of ["/dashboard/plans", "/dashboard/timestamps", "/dashboard/media", "/dashboard/banner"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(307);
      expect(response.headers().location, path).toMatch(/\/signin$/);
    }
  });

  test("the Streamlabs queue cron refuses a call without the secret", async ({ request }) => {
    const response = await request.get("/api/cron/streamlabs-outbox");

    expect(response.status()).toBe(401);
  });

  test("the CSV export refuses signed-out visitors", async ({ request }) => {
    const response = await request.get("/api/dashboard/tips/export?range=7d");

    expect(response.status()).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
  });
});

test.describe("buying a pass: PayU's routes", () => {
  // With no PayU settings or database on the test server nothing can be settled, and each route
  // must say so plainly without a crash or a leak.
  test("the browser return sends the creator to the plans page with a plain word", async ({ request }) => {
    const response = await request.post("/api/payu/return", { form: { txnid: "FT0000000000000000", status: "success", hash: "x" }, maxRedirects: 0 });
    expect(response.status()).toBe(303);
    expect(response.headers().location).toMatch(/\/dashboard\/plans\?payment=(problem|pending)$/);
    // Not a form at all: still a plain redirect, never an error page.
    const odd = await request.post("/api/payu/return", { data: "not a form", headers: { "content-type": "text/plain" }, maxRedirects: 0 });
    expect(odd.status()).toBe(303);
    expect(odd.headers().location).toMatch(/payment=problem$/);
  });

  test("cancel goes back to the plans page", async ({ request }) => {
    for (const method of ["get", "post"] as const) {
      const response = await request[method]("/api/payu/cancel", { maxRedirects: 0 });
      expect(response.status()).toBe(303);
      expect(response.headers().location).toMatch(/\/dashboard\/plans\?payment=cancelled$/);
    }
  });

  test("the webhook refuses what is not a form, acknowledges refund and dispute notices, and never settles an unsigned post", async ({ request }) => {
    expect((await request.post("/api/webhooks/payu", { data: "x", headers: { "content-type": "text/plain" } })).status()).toBe(400);
    expect((await request.post("/api/webhooks/payu", { data: { type: "refund" } })).status()).toBe(200);
    const unsigned = await request.post("/api/webhooks/payu", { form: { txnid: "FT0000000000000000", status: "success", amount: "1.00" } });
    // Not set up here (503) or set up and refused for its signature (400): never accepted.
    expect([400, 503]).toContain(unsigned.status());
  });

  test("the plan-orders cron refuses a call without the secret", async ({ request }) => {
    expect((await request.get("/api/cron/plan-orders")).status()).toBe(401);
  });
});
