/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPPORT_EMAIL?: string;
  readonly VITE_PUBLIC_SITE_URL?: string;
  readonly VITE_STRIPE_PUBLIC_KEY?: string;
  readonly VITE_USE_MOCK_STRIPE?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_CATALOG_BACKEND?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Public origin of the Railway (or other) API — e.g. https://your-service.up.railway.app — no trailing slash. */
  readonly VITE_PUBLIC_API_URL?: string;
  /** Plausible domain as configured in Plausible (e.g. zephyrlux.com); loads `window.plausible`. */
  readonly VITE_ANALYTICS_PLAUSIBLE_DOMAIN?: string;
  /** GA4 measurement ID (G-XXXXXXXX); forward via `gtag` when present on `window`. */
  readonly VITE_ANALYTICS_GA_MEASUREMENT_ID?: string;
  /** When `true`, skip registering `/service-worker.js` (e.g. local debugging). */
  readonly VITE_DISABLE_SERVICE_WORKER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "web-push" {
  const webpush: {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
    sendNotification(
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
      payload: string | Buffer | null,
      options?: { TTL?: number },
    ): Promise<unknown>;
  };
  export default webpush;
}

declare module "busboy" {
  import type { IncomingHttpHeaders } from "node:http";
  import type { Writable } from "node:stream";

  function busboy(config: {
    headers: IncomingHttpHeaders;
    limits?: { files?: number; fileSize?: number };
  }): Writable;
  export default busboy;
}
