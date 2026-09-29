import { defineConfig, devices } from "@playwright/test";

const frontendPort = 3100;
const backendPort = 3101;
const frontendUrl = `http://localhost:${frontendPort}`;
const backendUrl = `http://localhost:${backendPort}`;
const databaseUrl = process.env.E2E_DATABASE_URL ?? "";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: frontendUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npm run start",
      cwd: "../backend",
      url: `${backendUrl}/api/games`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        E2E_DATABASE_URL: databaseUrl,
        PORT: String(backendPort),
        FRONTEND_URL: frontendUrl,
        JWT_SECRET: "ui-smoke-access-secret-at-least-32-characters",
        JWT_REFRESH_SECRET: "ui-smoke-refresh-secret-at-least-32-characters",
        JWT_RESET_SECRET: "ui-smoke-reset-secret-at-least-32-characters",
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: "2525",
        SMTP_SECURE: "false",
        SMTP_USER: "ui-smoke",
        SMTP_APP_PASSWORD: "ui-smoke",
        EMAIL_FROM: "ArenaVerse Smoke <smoke@e2e.test>",
      },
    },
    {
      command: `npm run dev -- -p ${frontendPort}`,
      url: frontendUrl,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: `${backendUrl}/api`,
      },
    },
  ],
});
