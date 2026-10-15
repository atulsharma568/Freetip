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
    }
  });

  test("sitemap.xml lists the public landing and signup routes", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    const body = await response.text();

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/xml/i);
    expect(body).toContain("<urlset");
    const locations = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => new URL(match[1]).pathname,
    );
    expect(locations).toContain("/");
    expect(locations).toContain("/signup");
  });

  test("home exposes its title, description, social cards and theme metadata", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveTitle("Tipsite: tips for YouTube streamers, paid by UPI or card");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      "Your link. Their UPI. Your bank. Tips for Indian YouTube streamers: fans pay with UPI or card, no account needed, with OBS alerts and text-to-speech.",
    );
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "website");
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
      "content",
      "Tipsite",
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
    await expect(page).toHaveTitle("Sign up: Tipsite");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      "Join the Tipsite waitlist and hear when sign-up opens.",
    );
  });

  for (const route of ["/terms", "/privacy"]) {
    test(`${route} has a noindex robots meta tag`, async ({ page }) => {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        /noindex/i,
      );
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
