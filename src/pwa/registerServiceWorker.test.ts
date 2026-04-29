import { describe, expect, it } from "vitest";

import { shouldRegisterProductionServiceWorker } from "./registerServiceWorker";

describe("shouldRegisterProductionServiceWorker", () => {
  it("returns false without Service Worker API (e.g. jsdom/Vitest)", () => {
    expect(
      shouldRegisterProductionServiceWorker({
        hasServiceWorkerApi: false,
        isProduction: true,
        disableViaEnv: false,
      }),
    ).toBe(false);
  });

  it("returns false in development", () => {
    expect(
      shouldRegisterProductionServiceWorker({
        hasServiceWorkerApi: true,
        isProduction: false,
        disableViaEnv: false,
      }),
    ).toBe(false);
  });

  it("returns false when VITE_DISABLE_SERVICE_WORKER is true", () => {
    expect(
      shouldRegisterProductionServiceWorker({
        hasServiceWorkerApi: true,
        isProduction: true,
        disableViaEnv: true,
      }),
    ).toBe(false);
  });

  it("returns true only when prod, SW API, and not disabled", () => {
    expect(
      shouldRegisterProductionServiceWorker({
        hasServiceWorkerApi: true,
        isProduction: true,
        disableViaEnv: false,
      }),
    ).toBe(true);
  });
});
