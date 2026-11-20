import { defineConfig, devices } from "@playwright/test";

/** Port of `vite preview`, which serves the built app with the production headers. */
const PORT = 4173;
const isCI = process.env.CI !== undefined && process.env.CI !== "";

/**
 * End-to-end tests (plan §16.1): Chromium against the built quiz app, the API
 * mocked in the page. Run them with `pnpm turbo test:e2e`, which builds first.
 */
export default defineConfig({
  testDir: ".",
  outputDir: "../test-results",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI
    ? [["github"], ["html", { outputFolder: "../playwright-report", open: "never" }]]
    : [["list"]],
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // The preview server sends the CSP of vercel.json, so QuickJS runs under it.
    command: `pnpm exec vite preview --port ${String(PORT)} --strictPort`,
    cwd: "..",
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: !isCI,
  },
});
