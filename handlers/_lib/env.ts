export const ENV = {
  NODE_ENV: process.env.NODE_ENV || "development",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "",
  /** Supabase project URL — server only; required for order + payment_events persistence (Epic 4). */
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
  /** Service role — server only; never expose to Vite. */
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  /** Anon key — server-only for JWT verification (`auth.getUser`); same value as VITE_SUPABASE_ANON_KEY. */
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "",
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
  /**
   * When true, `api/admin-order-fulfillment` may send the customer “shipped” notification (Story 5-6).
   * Default unset/false keeps Story 5-4 fulfillment-only until email is explicitly enabled in deploy.
   */
  ENABLE_CUSTOMER_SHIPMENT_NOTIFICATION: ["1", "true", "yes"].includes(
    (process.env.ENABLE_CUSTOMER_SHIPMENT_NOTIFICATION || "").trim().toLowerCase(),
  ),
  /**
   * Story 8-6: optional owner push prototype. Requires VAPID_* and web-push on the server.
   */
  ENABLE_OWNER_PUSH_NOTIFICATIONS: ["1", "true", "yes"].includes(
    (process.env.ENABLE_OWNER_PUSH_NOTIFICATIONS || "").trim().toLowerCase(),
  ),
  /** VAPID public key (URL-safe base64). Server + client `PushManager.subscribe` use the same public material. */
  VAPID_PUBLIC_KEY: (process.env.VAPID_PUBLIC_KEY || "").trim(),
  /** VAPID private key (URL-safe base64). Server only — never expose to Vite or the browser. */
  VAPID_PRIVATE_KEY: (process.env.VAPID_PRIVATE_KEY || "").trim(),
  /** VAPID subject contact per RFC 8292 (`mailto:` or `https:` URL). */
  VAPID_SUBJECT: (process.env.VAPID_SUBJECT || "").trim(),
};

export function isOwnerPushNotificationsConfigured(): boolean {
  return (
    ENV.ENABLE_OWNER_PUSH_NOTIFICATIONS &&
    Boolean(ENV.VAPID_PUBLIC_KEY && ENV.VAPID_PRIVATE_KEY && ENV.VAPID_SUBJECT)
  );
}

export function isSupabaseOrderPersistenceConfigured(): boolean {
  return Boolean(ENV.SUPABASE_URL && ENV.SUPABASE_SERVICE_ROLE_KEY);
}


