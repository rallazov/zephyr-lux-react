import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  ACCOUNT_ORDER_HISTORY_FAILED_BODY,
  fetchCustomerAccountOrderDetail,
  fetchCustomerAccountOrderList,
  parseAccountOrderIdParam,
} from "./_lib/customerAccountOrderHistory";
import { ENV, isSupabaseOrderPersistenceConfigured } from "./_lib/env";
import { log } from "./_lib/logger";
import {
  getBearerAuthorizationHeader,
  resolveVerifiedCustomerIdForCheckoutOrder,
} from "./_lib/verifyAdminJwt";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin";
import { parseCustomerOrderStatusWirePayload } from "../src/order-status/customerOrderStatusWirePayload";

function cors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", ENV.FRONTEND_URL);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "no-store");
}

function queryParam(query: VercelRequest["query"], key: string): string | undefined {
  const raw = query[key];
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];
  return undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!isSupabaseOrderPersistenceConfigured()) {
    return res.status(503).json({ error: "Order history not configured" });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: "Order history not available" });
  }

  const bearer = getBearerAuthorizationHeader(req.headers.authorization);
  if (!bearer) {
    return res.status(401).json({ error: "Missing or invalid session" });
  }

  try {
    const customerId = await resolveVerifiedCustomerIdForCheckoutOrder({
      admin,
      bearerAccessToken: bearer,
    });
    if (!customerId) {
      return res.status(401).json({ error: "Missing or invalid session" });
    }

    const rawOrderId = queryParam(req.query, "order_id");
    const orderId = rawOrderId ? parseAccountOrderIdParam(rawOrderId) : null;
    if (rawOrderId && !orderId) {
      return res.status(400).json({ error: "Invalid order identifier" });
    }

    if (orderId) {
      const detail = await fetchCustomerAccountOrderDetail({
        admin,
        customerId,
        orderId,
      });
      if (detail.status === 500) {
        log.warn("customer-account-order-history: detail fetch failed");
        return res.status(500).json({ error: ACCOUNT_ORDER_HISTORY_FAILED_BODY });
      }
      if (detail.status === 404) {
        return res.status(404).json({ error: "Order not available" });
      }
      const safeDetail = parseCustomerOrderStatusWirePayload(detail.body as unknown);
      if (!safeDetail) {
        log.warn("customer-account-order-history: detail response failed wire validation");
        return res.status(500).json({ error: ACCOUNT_ORDER_HISTORY_FAILED_BODY });
      }
      return res.status(200).json(safeDetail);
    }

    const listResult = await fetchCustomerAccountOrderList({ admin, customerId });
    if (listResult.status === 500) {
      log.warn("customer-account-order-history: list fetch failed");
      return res.status(500).json({ error: ACCOUNT_ORDER_HISTORY_FAILED_BODY });
    }
    return res.status(200).json(listResult.body);
  } catch (err: unknown) {
    log.error({ err }, "customer-account-order-history failed");
    return res.status(500).json({ error: ACCOUNT_ORDER_HISTORY_FAILED_BODY });
  }
}
