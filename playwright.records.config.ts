import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/records-ui",
  outputDir: ".impeccable/test-results/records-ui",
  fullyParallel: true,
  retries: 0,
  use: { baseURL: "http://127.0.0.1:3231", trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "npm run preview:frontend",
    env: { PREVIEW_PORT: "3231" },
    url: "http://127.0.0.1:3231/admin/frota",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
