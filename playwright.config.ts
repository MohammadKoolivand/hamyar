import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  use: {
    baseURL,
    headless: true,
    // Use Playwright's installed Chromium unless an explicit Chrome path is provided.
    ...(process.env.CHROME_PATH
      ? { launchOptions: { executablePath: process.env.CHROME_PATH } }
      : {}),
    trace: "retain-on-failure",
  },
  // CI starts the production server after build so PWA/service worker tests are meaningful.
  ...(process.env.CI
    ? {
        webServer: {
          command: "npm start",
          url: baseURL + "/api/health",
          reuseExistingServer: false,
          timeout: 120000,
        },
      }
    : {}),
  reporter: "list",
});
