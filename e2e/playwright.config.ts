/**
 * End-to-end smoke suite (docs/testing.md). `pnpm e2e` from the repo root.
 * `src/stack.adapter.ts` starts the API and a production build of the web app on their own
 * ports and a throwaway database, and stops them afterwards.
 */
import { defineConfig, devices } from "@playwright/test";
import { env, WEB_URL } from "./src/env.ts";

export default defineConfig({
  testDir: "tests",
  globalSetup: "./src/stack.adapter.ts",
  // A committed `.only` would silently skip the rest of the suite.
  forbidOnly: true,
  fullyParallel: true,
  workers: env.CI ? 2 : 4,
  // A retry would hide flakiness; a flaky journey is a bug to fix.
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
