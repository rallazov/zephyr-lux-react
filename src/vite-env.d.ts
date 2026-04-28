/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PUBLIC_SITE_URL?: string;
  readonly VITE_STRIPE_PUBLIC_KEY?: string;
  readonly VITE_USE_MOCK_STRIPE?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_CATALOG_BACKEND?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Plausible domain as configured in Plausible (e.g. zephyrlux.com); loads `window.plausible`. */
  readonly VITE_ANALYTICS_PLAUSIBLE_DOMAIN?: string;
  /** GA4 measurement ID (G-XXXXXXXX); forward via `gtag` when present on `window`. */
  readonly VITE_ANALYTICS_GA_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
