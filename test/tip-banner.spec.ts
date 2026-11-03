import { expect, test } from "@playwright/test";
import { fetchChannelBanner, safeBannerUrl } from "../src/lib/tip-banner";
import { planFeatures, sanitizeFeatureKeys } from "../src/lib/plans";

// The YouTube banner behind the photo on the tip page (paid feature "tipBanner").

const GOOD = "https://yt3.googleusercontent.com/abc123_XYZ";
const ENV = { YT_DATA_API_KEY: "key" } as unknown as NodeJS.ProcessEnv;

function fakeFetch(body: unknown, status = 200): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

test.describe("which banner addresses are drawn", () => {
  test("Google image hosts over https pass", () => {
    expect(safeBannerUrl(GOOD)).toBe(GOOD);
    expect(safeBannerUrl("https://yt3.ggpht.com/x")).toBe("https://yt3.ggpht.com/x");
  });

  test("an upload in our own banner folder passes", () => {
    const ok = "https://abc123.public.blob.vercel-storage.com/banners/7/banner-x1y2.gif";
    expect(safeBannerUrl(ok)).toBe(ok);
    for (const bad of [
      "https://abc123.public.blob.vercel-storage.com/media/7/banner.gif",
      "https://abc123.public.blob.vercel-storage.com/banners/seven/a.gif",
      "https://abc123.public.blob.vercel-storage.com/banners/7/../../a.gif",
      "https://abc123.public.blob.vercel-storage.com/banners/7/sub/a.gif",
      "http://abc123.public.blob.vercel-storage.com/banners/7/a.gif",
    ]) {
      expect(safeBannerUrl(bad)).toBeNull();
    }
  });

  test("anything else is refused", () => {
    for (const bad of [
      null,
      "",
      42,
      "http://yt3.googleusercontent.com/x",
      "https://evil.example.com/x",
      "https://googleusercontent.com.evil.example/x",
      "https://user:pw@yt3.googleusercontent.com/x",
      "https://yt3.googleusercontent.com:8443/x",
      "javascript:alert(1)",
      "not a url",
      `https://yt3.googleusercontent.com/${"a".repeat(700)}`,
    ]) {
      expect(safeBannerUrl(bad)).toBeNull();
    }
  });
});

test.describe("reading the banner from YouTube", () => {
  test("returns the banner address", async () => {
    const r = await fetchChannelBanner(
      "UCabcdefghijklmnopqrstuv",
      ENV,
      fakeFetch({ items: [{ brandingSettings: { image: { bannerExternalUrl: GOOD } } }] }),
    );
    expect(r).toEqual({ ok: true, url: GOOD });
  });

  test("says why there is none", async () => {
    const id = "UCabcdefghijklmnopqrstuv";
    expect(await fetchChannelBanner(id, {} as NodeJS.ProcessEnv, fakeFetch({}))).toEqual({ ok: false, reason: "not-configured" });
    expect(await fetchChannelBanner(null, ENV, fakeFetch({}))).toEqual({ ok: false, reason: "no-channel" });
    expect(await fetchChannelBanner("a/b?c", ENV, fakeFetch({}))).toEqual({ ok: false, reason: "no-channel" });
    expect(await fetchChannelBanner(id, ENV, fakeFetch({ items: [] }))).toEqual({ ok: false, reason: "no-channel" });
    expect(await fetchChannelBanner(id, ENV, fakeFetch({ items: [{ brandingSettings: {} }] }))).toEqual({ ok: false, reason: "no-banner" });
    expect(
      await fetchChannelBanner(id, ENV, fakeFetch({ items: [{ brandingSettings: { image: { bannerExternalUrl: "https://evil.example/x" } } }] })),
    ).toEqual({ ok: false, reason: "no-banner" });
    expect(await fetchChannelBanner(id, ENV, fakeFetch({}, 403))).toEqual({ ok: false, reason: "failed" });
  });

  test("a network failure is reported, not thrown", async () => {
    const boom = (async () => {
      throw new Error("down");
    }) as unknown as typeof fetch;
    expect(await fetchChannelBanner("UCabcdefghijklmnopqrstuv", ENV, boom)).toEqual({ ok: false, reason: "failed" });
  });
});

test("the switch is off by default and can be stored once built", () => {
  expect(planFeatures(null).tipBanner).toBe(false);
  expect(planFeatures({ paid_features: ["tipBanner"] }).tipBanner).toBe(true);
  expect(sanitizeFeatureKeys(["tipBanner", "nonsense"])).toEqual(["tipBanner"]);
});
