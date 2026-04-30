import { defineConfig, devices } from "@playwright/test";

const host = process.env.PLAYWRIGHT_HOST ?? "127.0.0.1";
const port = Number(process.env.PLAYWRIGHT_PORT ?? "4173");
const remoteBase = process.env.PLAYWRIGHT_BASE_URL?.trim();
const baseURL =
  remoteBase && remoteBase.length > 0
    ? remoteBase.replace(/\/$/, "")
    : `http://${host}:${port}`;
const startLocalPreview =
  !remoteBase &&
  process.env.PLAYWRIGHT_SKIP_WEBSERVER !== "1";

/**
 * Default: Playwright targets the production bundle (`vite preview`).
 * Run `npm run build` before `npm run test:e2e`, or use `npm run test:e2e:ci`.
 *
 * Remote storefront (staging/production — no local preview started):  
 * `PLAYWRIGHT_BASE_URL=https://your-origin.example npm run test:e2e`
 *
 * Custom preview URL already running locally:  
 * `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e`
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
  ...(startLocalPreview
    ? {
        webServer: {
          command: `npm run preview -- --host ${host} --strictPort --port ${port}`,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }
    : {}),
});
