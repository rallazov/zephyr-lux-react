import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  CUSTOMER_ORDER_STATUS_LOOKUP_FAILED,
  parseCustomerOrderStatusToken,
  resolveCustomerOrderStatus,
} from "./_lib/customerOrderStatus";
import { ENV, isSupabaseOrderPersistenceConfigured } from "./_lib/env";
import { log } from "./_lib/logger";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin";

/** CORS plus no-store — bearer-token order payloads must never be cached by proxies or browsers. */
function privateHeaders(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", ENV.FRONTEND_URL);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "no-store");
}

function queryParam(query: VercelRequest["query"], key: string): string {
  const raw = query[key];
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];
  return "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  privateHeaders(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const token = parseCustomerOrderStatusToken(queryParam(req.query, "token"));
  if (!token) {
    return res.status(400).json({ error: "Missing or invalid token" });
  }

  if (!isSupabaseOrderPersistenceConfigured()) {
    return res.status(503).json({ error: "Order status lookup not configured" });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: "Order status lookup not available" });
  }

  try {
    const result = await resolveCustomerOrderStatus({ admin, token });
    if (result.status === 500) {
      log.warn("customer-order-status: lookup failed");
    }
    return res.status(result.status).json(result.body);
  } catch (err: unknown) {
    log.error({ err }, "customer-order-status failed");
    return res.status(500).json({ error: CUSTOMER_ORDER_STATUS_LOOKUP_FAILED });
  }
}
