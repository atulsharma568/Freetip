import { expect, test } from "@playwright/test";
import { hostRedirects } from "../src/lib/redirects";
import { organizationData } from "../src/components/OrganizationSchema";

test.describe("host redirects", () => {
  test("none until the main domain is set", () => {
    expect(hostRedirects(undefined, "tipsite.vercel.app")).toEqual([]);
    expect(hostRedirects("", "tipsite.vercel.app")).toEqual([]);
    expect(hostRedirects("not a url", "tipsite.vercel.app")).toEqual([]);
  });

  test("the vercel.app address and www go to the main domain with a 301", () => {
    const rules = hostRedirects("https://tipsite.in", "tipsite.vercel.app");
    const hosts = rules.map((r) => r.has[0].value);
    expect(new Set(hosts)).toEqual(new Set(["tipsite.vercel.app", "www.tipsite.in"]));
    for (const rule of rules) {
      expect(rule.statusCode).toBe(301);
      expect(rule.destination.startsWith("https://tipsite.in/")).toBe(true);
    }
  });

  test("a www main domain redirects the bare domain, never itself", () => {
    const hosts = hostRedirects("https://www.tipsite.in", "www.tipsite.in").map((r) => r.has[0].value);
    expect(new Set(hosts)).toEqual(new Set(["tipsite.in"]));
  });

  test("api routes are excluded so webhooks and sign-in callbacks keep working", () => {
    const paths = hostRedirects("https://tipsite.in").filter((r) => r.source !== "/");
    expect(paths.length).toBeGreaterThan(0);
    for (const rule of paths) expect(rule.source).toContain("(?!api/)");
  });
});

test.describe("organization schema", () => {
  test("writes nothing while the domain or operator details are missing", () => {
    expect(organizationData()).toBeNull();
  });
});
