import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { fulfillmentStatusSchema } from "../src/domain/commerce/enums";
import { maybeSendCustomerShipmentNotification } from "./_lib/customerShipmentNotification";
import { ENV, isSupabaseOrderPersistenceConfigured } from "./_lib/env";
import { log } from "./_lib/logger";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin";
import { verifyAdminJwt } from "./_lib/verifyAdminJwt";

const bodySchema = z.object({
  fulfillment_status: fulfillmentStatusSchema,
});

function cors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", ENV.FRONTEND_URL);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "PATCH, POST, OPTIONS");
}

function orderIdFromQuery(query: VercelRequest["query"]): string {
  const raw = query.order_id;
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0].trim();
  return "";
}

function bearer(req: VercelRequest): string | null {
  const h = req.headers.authorization;
  if (!h || typeof h !== "string") return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m?.[1]?.trim() || null;
}

function mapRpcError(message: string): { status: number; error: string } {
  if (message.includes("order_not_found")) {
    return { status: 404, error: "Order not found" };
  }
  if (message.includes("not_paid")) {
    return { status: 409, error: "Order must be paid before fulfillment can advance." };
  }
  if (message.includes("terminal_state")) {
    return { status: 409, error: "Fulfillment cannot change from this status." };
  }
  if (message.includes("invalid_transition")) {
    return { status: 409, error: "This fulfillment step is not allowed." };
  }
  return { status: 500, error: "Fulfillment update failed" };
}

/**
 * Admin-only: PATCH/POST `{ fulfillment_status }` with `?order_id=<uuid>`.
 * Verifies JWT + admin role, then applies transition via `apply_fulfillment_transition` RPC.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "PATCH" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const orderId = orderIdFromQuery(req.query);
  const uuidParse = z.string().uuid().safeParse(orderId);
  if (!uuidParse.success) {
    return res.status(400).json({ error: "Invalid order_id" });
  }

  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
    log.warn("admin-order-fulfillment: missing Supabase URL or anon key for JWT verify");
    return res.status(503).json({ error: "Admin fulfillment not configured" });
  }

  if (!isSupabaseOrderPersistenceConfigured()) {
    return res.status(503).json({ error: "Admin fulfillment not configured" });
  }

  const adminClient = getSupabaseAdmin();
  if (!adminClient) {
    return res.status(503).json({ error: "Admin fulfillment not available" });
  }

  const token = bearer(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const verified = await verifyAdminJwt(token);
  if (!verified) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  const { fulfillment_status: toStatus } = parsed.data;

  try {
    const { data, error } = await adminClient.rpc("apply_fulfillment_transition", {
      p_order_id: orderId,
      p_to: toStatus,
      p_actor_user_id: verified.userId,
    });

    if (error) {
      const msg = error.message || "";
      const mapped = mapRpcError(msg);
      if (mapped.status === 500) {
        log.warn({ err: error, order_id: orderId }, "admin-order-fulfillment: rpc error");
      }
      return res.status(mapped.status).json({ error: mapped.error });
    }

    const row = data as { changed?: boolean; ok?: boolean; from?: string; to?: string } | null;
    if (row?.changed === false) {
      return res.status(204).end();
    }

    if (toStatus === "shipped" && ENV.ENABLE_CUSTOMER_SHIPMENT_NOTIFICATION) {
      try {
        await maybeSendCustomerShipmentNotification({
          admin: adminClient,
          orderId,
        });
      } catch (notifyErr: unknown) {
        log.warn(
          { err: notifyErr, order_id: orderId },
          "admin-order-fulfillment: customer shipment notify failed after transition",
        );
      }
    }

    return res.status(200).json({
      ok: true,
      changed: true,
      fulfillment_status: toStatus,
      ...row,
    });
  } catch (err: unknown) {
    log.error({ err, order_id: orderId }, "admin-order-fulfillment failed");
    return res.status(500).json({ error: "Fulfillment update failed" });
  }
}
