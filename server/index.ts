/**
 * Single Node HTTP server for Railway (and local `npm run api:dev`).
 * Mounts the same handlers previously deployed as Vercel `/api/*` functions.
 */
import express from "express";
import type { VercelRequest, VercelResponse } from "@vercel/node";

import { ENV } from "../handlers/_lib/env";
import adminOrderFulfillment from "../handlers/admin-order-fulfillment";
import adminOrderInternalNote from "../handlers/admin-order-internal-note";
import adminPushSubscription from "../handlers/admin-push-subscription";
import adminShipment from "../handlers/admin-shipment";
import adminShipmentImage from "../handlers/admin-shipment-image";
import adminShipmentImages from "../handlers/admin-shipment-images";
import cartQuote from "../handlers/cart-quote";
import createBillingPortalSession from "../handlers/create-billing-portal-session";
import createPaymentIntent from "../handlers/create-payment-intent";
import createSubscriptionCheckoutSession from "../handlers/create-subscription-checkout-session";
import customerOrderStatus from "../handlers/customer-order-status";
import orderByPaymentIntent from "../handlers/order-by-payment-intent";
import orderLookupRequest from "../handlers/order-lookup-request";
import stripeWebhook from "../handlers/stripe-webhook";

type ApiHandler = (req: VercelRequest, res: VercelResponse) => void | Promise<void | VercelResponse>;

function allowedBrowserOrigins(): Set<string> {
  const out = new Set<string>();
  const push = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    try {
      out.add(new URL(t).origin);
    } catch {
      /* skip invalid */
    }
  };
  push(ENV.FRONTEND_URL);
  for (const part of (process.env.CORS_ALLOWED_ORIGINS || "").split(",")) push(part);
  return out;
}

const allowedOrigins = allowedBrowserOrigins();

function wrap(handler: ApiHandler): express.RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req as unknown as VercelRequest, res as unknown as VercelResponse)).catch(next);
  };
}

const app = express();

app.disable("x-powered-by");

// Browser CORS for split deploy (storefront on Vercel, API on Railway). Non-browser callers omit Origin.
app.use((req, res, next) => {
  const origin = req.get("Origin");
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.append("Vary", "Origin");
  }
  if (req.method === "OPTIONS") {
    const hdr = req.get("Access-Control-Request-Headers");
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,PATCH,PUT,DELETE,OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      hdr || "Content-Type, Authorization, Stripe-Signature",
    );
    res.setHeader("Access-Control-Max-Age", "86400");
    res.status(204).end();
    return;
  }
  next();
});

app.get("/health", (_req, res) => {
  res.status(200).type("text/plain").send("ok");
});

// Raw-body / multipart routes — must run before express.json()
app.all("/api/stripe-webhook", wrap(stripeWebhook));
app.all("/api/admin-shipment-image", wrap(adminShipmentImage));

app.use(express.json({ limit: "6mb" }));

const jsonRoutes: Array<[string, ApiHandler]> = [
  ["/api/cart-quote", cartQuote],
  ["/api/create-payment-intent", createPaymentIntent],
  ["/api/order-by-payment-intent", orderByPaymentIntent],
  ["/api/customer-order-status", customerOrderStatus],
  ["/api/order-lookup-request", orderLookupRequest],
  ["/api/admin-order-fulfillment", adminOrderFulfillment],
  ["/api/admin-order-internal-note", adminOrderInternalNote],
  ["/api/admin-shipment", adminShipment],
  ["/api/admin-shipment-images", adminShipmentImages],
  ["/api/admin-push-subscription", adminPushSubscription],
  ["/api/create-subscription-checkout-session", createSubscriptionCheckoutSession],
  ["/api/create-billing-portal-session", createBillingPortalSession],
];

for (const [path, h] of jsonRoutes) {
  app.all(path, wrap(h));
}

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ): void => {
    const msg = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) {
      res.status(500).type("text/plain").send(`handler error: ${msg}`);
    }
  },
);

const port = Number(process.env.PORT) || 3333;
app.listen(port, () => {
  console.info(`[api] listening on http://127.0.0.1:${port}`);
});
