import { expect, test } from "@playwright/test";

const TOKEN = "a".repeat(43);

// Half a second of silence as a WAV: small, and a browser can read its length.
function silentWav(): Buffer {
  const samples = 4000;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + samples, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(8000, 24);
  header.writeUInt32LE(8000, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write("data", 36);
  header.writeUInt32LE(samples, 40);
  return Buffer.concat([header, Buffer.alloc(samples, 128)]);
}

const SPEAKING_ALERT = {
  alert: { id: 7, kind: "alert", name: "Riya", amountPaise: 25000, message: "great stream", speech: true },
};

test.describe("OBS overlay routes", () => {
  test("preview plays a sample alert and switches to the vertical layout", async ({ page }) => {
    await page.goto("/overlay/preview");
    const stage = page.getByTestId("preview-stage");
    await expect(stage.getByRole("status")).toContainText("Riya");
    await expect(stage.getByRole("status")).toContainText("₹250");

    await page.getByRole("button", { name: /Vertical/ }).click();
    await expect(stage.locator(".ov-portrait")).toHaveCount(1);
    await expect(stage.getByRole("status")).toContainText("Riya");
  });

  test("live overlay page has no site chrome and a transparent background", async ({ page }) => {
    await page.goto(`/overlay/${TOKEN}`);
    await expect(page.locator("footer")).toHaveCount(0);
    await expect(page.locator("header")).toHaveCount(0);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgba(0, 0, 0, 0)");
  });

  test("a malformed token is a 404 page and a 404 from the API", async ({ page, request }) => {
    const res = await page.goto("/overlay/not-a-real-token");
    expect(res?.status()).toBe(404);
    expect((await request.get("/api/overlay/not-a-real-token")).status()).toBe(404);
  });

  test("the API answers 503 without a database and never caches", async ({ request }) => {
    const res = await request.get(`/api/overlay/${TOKEN}`);
    expect(res.status()).toBe(503);
    expect(res.headers()["cache-control"]).toBe("no-store");
  });

  test("overlay pages are kept out of search results", async ({ page }) => {
    await page.goto(`/overlay/${TOKEN}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("the speech route rejects a bad id and, without a database, answers 503", async ({ request }) => {
    expect((await request.get(`/api/overlay/${TOKEN}/speech/abc`)).status()).toBe(404);
    const res = await request.get(`/api/overlay/${TOKEN}/speech/7`);
    expect(res.status()).toBe(503);
    expect(res.headers()["cache-control"]).toBe("no-store");
  });

  test("an alert with speech downloads the audio and plays it with the card", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __plays: number }).__plays = 0;
      HTMLMediaElement.prototype.play = function () {
        (window as unknown as { __plays: number }).__plays += 1;
        return Promise.resolve();
      };
    });
    let served = false;
    await page.route(`**/api/overlay/${TOKEN}`, (route) =>
      route.fulfill({ json: served ? { alert: null } : SPEAKING_ALERT }).then(() => {
        served = true;
      }),
    );
    let speechRequests = 0;
    await page.route(`**/api/overlay/${TOKEN}/speech/7`, (route) => {
      speechRequests += 1;
      return route.fulfill({ status: 200, contentType: "audio/wav", body: silentWav() });
    });

    await page.goto(`/overlay/${TOKEN}`);
    await expect(page.getByRole("status")).toContainText("great stream");
    expect(speechRequests).toBe(1);
    expect(await page.evaluate(() => (window as unknown as { __plays: number }).__plays)).toBeGreaterThan(0);
  });

  test("if the speech is unavailable the alert still shows, silently", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __plays: number }).__plays = 0;
      HTMLMediaElement.prototype.play = function () {
        (window as unknown as { __plays: number }).__plays += 1;
        return Promise.resolve();
      };
    });
    let served = false;
    await page.route(`**/api/overlay/${TOKEN}`, (route) =>
      route.fulfill({ json: served ? { alert: null } : SPEAKING_ALERT }).then(() => {
        served = true;
      }),
    );
    await page.route(`**/api/overlay/${TOKEN}/speech/7`, (route) =>
      route.fulfill({ status: 204 }),
    );

    await page.goto(`/overlay/${TOKEN}`);
    await expect(page.getByRole("status")).toContainText("great stream");
    expect(await page.evaluate(() => (window as unknown as { __plays: number }).__plays)).toBe(0);
  });
});
