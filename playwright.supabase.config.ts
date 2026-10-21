import { defineConfig, devices } from "@playwright/test";
import nextEnvironment from "@next/env";
nextEnvironment.loadEnvConfig(process.cwd(), false, {
  info: () => {},
  error: () => {},
});
const baseURL = process.env.E2E_APP_URL;
if (
  !baseURL ||
  !["127.0.0.1", "localhost", "[::1]"].includes(new URL(baseURL).hostname) ||
  process.env.E2E_LOCAL_DISPOSABLE !== "yes"
)
  throw new Error(
    "Requer E2E_APP_URL local e E2E_LOCAL_DISPOSABLE=yes em stack descartável.",
  );
export default defineConfig({
  testDir: "./tests/supabase",
  workers: 1,
  fullyParallel: false,
  timeout: 60000,
  retries: 0,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${new URL(baseURL).port || 3200}`,
    url: new URL("/api/v1/health", baseURL).href,
    reuseExistingServer: false,
    timeout: 60000,
  },
});
