export const ENV = {
  NODE_ENV: process.env.NODE_ENV || "development",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "",
  /** Supabase project URL — server only; required for order + payment_events persistence (Epic 4). */
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
  /** Service role — server only; never expose to Vite. */
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  RESEND_API_KEY: process.env.RESEND_API_KEY || "",
  /** Verified sender in Resend (e.g. orders@mail.yourdomain.com). Server-only. */
  RESEND_FROM: process.env.RESEND_FROM || "",
  /** Comma-separated owner inboxes for paid-order alerts (E4-S5). Server-only. */
  OWNER_NOTIFICATION_EMAIL: process.env.OWNER_NOTIFICATION_EMAIL || "",
  /** Customer support / contact in confirmation emails (E4-S6). `CONTACT_EMAIL` accepted as alias. */
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || process.env.CONTACT_EMAIL || "",
  STORE_BACKEND: process.env.STORE_BACKEND || "auto", // auto | blob | local
  VERCEL_BLOB_RW_TOKEN: process.env.VERCEL_BLOB_READ_WRITE_TOKEN || "",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
};

export function isSupabaseOrderPersistenceConfigured(): boolean {
  return Boolean(ENV.SUPABASE_URL && ENV.SUPABASE_SERVICE_ROLE_KEY);
}


