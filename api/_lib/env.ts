export const ENV = {
  NODE_ENV: process.env.NODE_ENV || "development",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "",
  RESEND_API_KEY: process.env.RESEND_API_KEY || "",
  STORE_BACKEND: process.env.STORE_BACKEND || "auto", // auto | blob | local
  VERCEL_BLOB_RW_TOKEN: process.env.VERCEL_BLOB_READ_WRITE_TOKEN || "",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
};


