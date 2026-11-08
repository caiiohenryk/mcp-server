import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3210);
const baseURL = `http://localhost:${PORT}`;

/**
 * E2E runs against `next dev` with dummy, non-secret configuration.
 * Public pages (/login) render without a database; nothing here touches Postgres.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm standards:index && pnpm exec next dev -p ${PORT}`,
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: "postgres://e2e:e2e@localhost:5432/e2e",
      AUTH_SECRET: "e2e-auth-secret-e2e-auth-secret-e2e-0000",
      TOKEN_PEPPER: "e2e-token-pepper-e2e-token-pepper-e2e-00",
      AUTH_URL: baseURL,
      AUTH_GOOGLE_ID: "e2e-google-id",
      AUTH_GOOGLE_SECRET: "e2e-google-secret",
    },
  },
});
