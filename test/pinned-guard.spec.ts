import { expect, test } from "@playwright/test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Paid highlighted messages must stay invisible on the public site: the owner has not decided
// to offer them, so no marketing page, policy page, FAQ, sitemap or shared component may
// mention a pinned or highlighted message. They may appear only where a creator who has the
// feature switched on can see them: the creator's own tip page ([handle]), the signed-in
// dashboard, the OBS overlay and its API, admin, and the plan catalogue.
//
// This scans the public surfaces (everything under src/app and src/components that is not one
// of those private places) for those phrases, after removing the ones that are about other
// things: the stream-timestamps "highlights page", YouTube "pinned comments", and a CSS class.
// (The build plan asked for a grep of "highlight" and "pinned" over all of src/app outside
// [handle] and admin; that would also hit the dashboard, overlay and API code that has to use
// the words, so the private places are listed above and the scan is on the public rest.)

const root = join(__dirname, "..", "src");

// Private places, relative to src/.
const PRIVATE = [
  "app/[handle]",
  "app/admin",
  "app/dashboard",
  "app/overlay",
  "app/api",
  "app/actions",
  "app/editor",
  "components/admin",
  "components/overlay",
  "components/tip",
];

const OTHER_THINGS = [/highlights pages?/gi, /pinned comments?/gi, /step-highlight/gi];
// Phrases about a fan's message being highlighted or pinned. A bare "highlight" is not
// matched, because the site's own code talks about visual highlights (a glow, a sliding
// block, a text selection) that have nothing to do with this feature.
const WORDS = [
  /highlighted/i,
  /highlight(s|ing)?\s+(your|my|a|the|their|his|her|this|that)\s+(message|tip|comment|post|note)/i,
  /highlight(s|ing)?\s+(messages?|tips?)/i,
  /(paid|premium|featured|extra)\s+highlights?/i,
  /pinned\s+(message|tip|card|note|text|post)/i,
  /\bpin(ning)?\b[^.\n]{0,24}\bmessages?\b/i,
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return /\.(ts|tsx|css|md|mdx)$/.test(name) ? [full] : [];
  });
}

const isPrivate = (file: string) => {
  const rel = relative(root, file).split("\\").join("/");
  return PRIVATE.some((p) => rel === p || rel.startsWith(`${p}/`));
};

const publicFiles = [...files(join(root, "app")), ...files(join(root, "components"))].filter((f) => !isPrivate(f));

test("the guard scans the public site, not nothing", () => {
  const rel = publicFiles.map((f) => relative(root, f).split("\\").join("/"));
  expect(rel).toContain("app/page.tsx");
  expect(rel).toContain("app/terms/page.tsx");
  expect(rel).toContain("components/sections/Faq.tsx");
  expect(rel.some((r) => r.startsWith("app/dashboard/"))).toBe(false);
  expect(rel.some((r) => r.startsWith("app/[handle]/"))).toBe(false);
});

test("no public page or shared component mentions pinned or highlighted messages", () => {
  const hits: string[] = [];
  for (const file of publicFiles) {
    let text = readFileSync(file, "utf8");
    for (const allowed of OTHER_THINGS) text = text.replace(allowed, "");
    text.split("\n").forEach((line, i) => {
      if (WORDS.some((w) => w.test(line))) hits.push(`${relative(root, file)}:${i + 1}: ${line.trim()}`);
    });
  }
  expect(hits, `These public files mention pinned or highlighted messages:\n${hits.join("\n")}`).toEqual([]);
});

test("the public data files the site reads from do not mention it either", () => {
  const extra = ["lib/legal.ts", "lib/site.ts", "lib/redirects.ts"].map((f) => join(root, f));
  for (const file of extra) {
    const text = readFileSync(file, "utf8");
    expect(WORDS.some((w) => w.test(text)), `${relative(root, file)} mentions it`).toBe(false);
  }
});
