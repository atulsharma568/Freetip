// The test-only tip page route (/dev-fixtures/tip) renders a made-up creator so the browser tests
// can check the page without a database. It answers 404 unless this is on, and only the
// Playwright config sets it. Never set PAGE_FIXTURES in Vercel.
export function fixturesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.PAGE_FIXTURES === "1";
}
