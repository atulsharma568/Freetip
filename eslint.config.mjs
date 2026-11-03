import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright's generated traces and last-run metadata.
    "test-results/**",
    "playwright-report/**",
    // Local tooling, not part of the site.
    // The OBS clip helper is its own small app with its own dependencies and tests.
    "tools/**",
  ]),
]);

export default eslintConfig;
