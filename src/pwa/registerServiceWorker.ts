/** Whether `/service-worker.js` should register in this runtime (exported for tests). */
export function shouldRegisterProductionServiceWorker(options: {
  hasServiceWorkerApi: boolean;
  isProduction: boolean;
  disableViaEnv: boolean;
}): boolean {
  return (
    options.hasServiceWorkerApi &&
    options.isProduction &&
    !options.disableViaEnv
  );
}

/**
 * Registers the small network-only worker in production (see `public/service-worker.js`).
 * Skips registration in development, Vitest/jsdom without `navigator.serviceWorker`,
 * or when `VITE_DISABLE_SERVICE_WORKER=true`.
 */
export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;

  const hasServiceWorkerApi = "serviceWorker" in navigator;

  const shouldRegister = shouldRegisterProductionServiceWorker({
    hasServiceWorkerApi,
    isProduction: import.meta.env.PROD === true,
    disableViaEnv: import.meta.env.VITE_DISABLE_SERVICE_WORKER === "true",
  });

  if (!shouldRegister) return;

  void navigator.serviceWorker
    .register("/service-worker.js", { scope: "/" })
    .catch((e) =>
      console.warn("[pwa] service worker registration failed", e),
    );
}
