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

const apiHealthURL =
  process.env.PLAYWRIGHT_API_HEALTH_URL?.trim() ||
  "http://127.0.0.1:3333/health";

/**
 * Default: Playwright targets the production bundle (`vite preview`).
 *
 * **`vite preview` has no `/api` proxy** (unlike `vite dev`). Without
 * `VITE_PUBLIC_API_URL` at build time, cart/checkout calls `POST /api/cart-quote`
 * on the preview origin and get **HTTP 404**. So local runs start:
 * 1. `npm run api:dev` (wait for `/health`)
 * 2. `npm run build:e2e` (uses `.env.e2e` → `VITE_PUBLIC_API_URL=http://127.0.0.1:3333`) + `vite preview`
 *
 * Remote storefront (staging/production — no local servers):  
 * `PLAYWRIGHT_BASE_URL=https://your-origin.example PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e`
 *
 * Custom preview + API already running:  
 * `PLAYWRIGHT_BASE_URL=... PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_API_ORIGIN=... npm run test:e2e`
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
        webServer: [
          {
            command: "npm run api:dev",
            url: apiHealthURL,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
          },
          {
            command: `npm run build:e2e && npm run preview -- --host ${host} --strictPort --port ${port}`,
            url: baseURL,
            reuseExistingServer: !process.env.CI,
            timeout: 180_000,
          },
        ],
      }
    : {}),
});
