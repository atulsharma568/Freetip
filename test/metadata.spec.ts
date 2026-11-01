import { expect, test } from "@playwright/test";

test.describe("search and sharing metadata", () => {
  test("robots.txt follows the configured crawl policy", async ({ request }) => {
    const response = await request.get("/robots.txt");
    const body = await response.text();

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/text\/plain/i);
    expect(body).toMatch(/^User-agent:\s*\*/im);
    // Crawlers are kept out until the real domain is set.
    if (process.env.NEXT_PUBLIC_SITE_URL) {
      expect(body).toMatch(/^Allow:\s*\/\s*$/im);
      expect(body).toMatch(/^Sitemap:\s*\S+\/sitemap\.xml/im);
    } else {
      expect(body).toMatch(/^Disallow:\s*\/\s*$/im);
      // Link-preview fetchers (WhatsApp's included) still get in.
      expect(body).toMatch(/^User-agent:\s*facebookexternalhit\s*$/im);
    }
  });

  test("sitemap.xml lists the home page and leaves out noindex pages", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    const body = await response.text();

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/xml/i);
    expect(body).toContain("<urlset");
    const locations = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => new URL(match[1]).pathname,
    );
    expect(locations).toContain("/");
    expect(locations).toEqual(expect.arrayContaining(["/terms", "/privacy", "/contact"]));
    // /signup and /signin are noindex, so they stay out of the sitemap.
    expect(locations).not.toContain("/signup");
    expect(locations).not.toContain("/signin");
  });

  test("home exposes its title, description, social cards and theme metadata", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveTitle("Freetip: tips for YouTube streamers, paid by UPI or card");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      "Your link. Their UPI. Your bank. Tips for Indian YouTube streamers: fans pay with UPI or card, no account needed, with OBS alerts and text-to-speech.",
    );
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "website");
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
      "content",
      "Freetip",
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /opengraph-image/,
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      "#12130e",
    );
    await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute("content", "dark");
  });

  test("signup exposes its route metadata", async ({ page }) => {
    await page.goto("/signup", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle("Sign up: Freetip");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /Create your Freetip account/,
    );
  });

  // The draft switch is off (owner, 2026-11-01): policy pages are indexable and listed.
  for (const route of ["/terms", "/privacy", "/contact"]) {
    test(`${route} is indexable and has no draft banner`, async ({ page }) => {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
      await expect(page.getByText("waiting for legal review")).toHaveCount(0);
      await expect(page.getByText("[", { exact: false }).filter({ hasText: /^\[[A-Za-z ,']+\]$/ })).toHaveCount(0);
    });
  }

  test("the Open Graph route returns a PNG image", async ({ request }) => {
    const response = await request.get("/opengraph-image");
    const image = await response.body();

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/^image\/png/i);
    expect(Array.from(image.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(image.readUInt32BE(16)).toBe(1200);
    expect(image.readUInt32BE(20)).toBe(630);
  });
});
