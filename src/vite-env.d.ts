/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STRIPE_PUBLIC_KEY?: string;
  readonly VITE_USE_MOCK_STRIPE?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_CATALOG_BACKEND?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
