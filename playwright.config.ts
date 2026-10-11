import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 20000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node scripts/e2e-api.mjs",
      url: "http://127.0.0.1:8001/api/health",
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command:
        "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100",
      url: "http://127.0.0.1:3100",
      reuseExistingServer: false,
      env: {
        STUDIO_BACKEND_URL: "http://127.0.0.1:8001",
        STUDIO_E2E: "1",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      timeout: 120000,
    },
  ],
});
