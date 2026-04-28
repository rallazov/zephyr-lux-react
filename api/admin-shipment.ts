import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  adminShipmentUpsertBodySchema,
  normalizedTrackingUrlForDb,
} from "./_lib/adminShipmentPayload";
import { ENV } from "./_lib/env";
import { log } from "./_lib/logger";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin";
import {
  getBearerAuthorizationHeader,
  verifyAdminJwt,
} from "./_lib/verifyAdminJwt";
import { maybeSendCustomerShipmentNotification } from "./_lib/customerShipmentNotification";

function cors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", ENV.FRONTEND_URL);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

/** Parse POST JSON into a plain record, or `{ kind }` explaining why not. */
function parseShipmentJsonBody(req: VercelRequest):
  | { kind: "ok"; payload: Record<string, unknown> }
  | { kind: "invalid_json" }
  | { kind: "bad_shape" }
  | { kind: "missing" } {
  if (typeof req.body === "string") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(req.body) as unknown;
    } catch {
      return { kind: "invalid_json" };
    }
    if (
      parsed === null
      || typeof parsed !== "object"
      || Array.isArray(parsed)
    ) {
      return { kind: "bad_shape" };
    }
    return { kind: "ok", payload: parsed as Record<string, unknown> };
  }
  const b = req.body;
  if (b === undefined || b === null) {
    return { kind: "missing" };
  }
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(b)) {
    return { kind: "bad_shape" };
  }
  if (typeof b !== "object" || Array.isArray(b)) {
    return { kind: "bad_shape" };
  }
  return { kind: "ok", payload: b as Record<string, unknown> };
}

/** Admin-only upsert of `shipments` (`service_role`; AC3). Story 5-6: `maybeSendCustomerShipmentNotification` (idempotent marker on `orders`). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const bodyParse = parseShipmentJsonBody(req);
  if (bodyParse.kind === "invalid_json") {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  if (bodyParse.kind === "bad_shape") {
    return res.status(400).json({ error: "Expected JSON object body" });
  }
  if (bodyParse.kind === "missing") {
    return res.status(400).json({ error: "Missing JSON body" });
  }
  const raw = bodyParse.payload;

  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
    return res.status(503).json({ error: "Auth verification not configured" });
  }

  const token = getBearerAuthorizationHeader(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ error: "Missing Authorization Bearer" });
  }

  const verified = await verifyAdminJwt(token);
  if (!verified) {
    return res.status(403).json({ error: "Admin role required or invalid session" });
  }

  const parsed = adminShipmentUpsertBodySchema.safeParse(raw);
  if (!parsed.success) {
    log.warn({ issues: parsed.error.issues }, "admin-shipment: validation failed");
    return res.status(400).json({
      error: "Invalid payload",
      issues: parsed.error.issues.map((i) => ({
        path: i.path.filter((p) => typeof p === "string" || typeof p === "number"),
        message: i.message,
      })),
    });
  }

  const data = parsed.data;

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: "Shipments persistence not configured" });
  }

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("id, payment_status, fulfillment_status")
    .eq("id", data.order_id)
    .maybeSingle();

  if (orderErr || !order) {
    log.warn({ err: orderErr }, "admin-shipment: order lookup");
    return res.status(404).json({ error: "Order not found" });
  }

  if (order.payment_status !== "paid") {
    return res.status(400).json({
      error: "Tracking can only be saved for paid orders",
    });
  }

  if (order.fulfillment_status !== "shipped") {
    return res.status(400).json({
      error: "Fulfillment status must be Shipped before saving carrier / tracking",
    });
  }

  const tracking_url = normalizedTrackingUrlForDb({
    carrier: data.carrier,
    tracking_number: data.tracking_number,
    tracking_url: data.tracking_url,
  });

  const { data: prev, error: prevErr } = await admin
    .from("shipments")
    .select("shipped_at")
    .eq("order_id", data.order_id)
    .maybeSingle();

  if (prevErr) {
    log.warn({ err: prevErr }, "admin-shipment: existing shipment lookup");
    return res.status(500).json({ error: "Shipment save failed" });
  }

  const nowIso = new Date().toISOString();
  const shipped_at =
    prev && typeof (prev as { shipped_at?: string | null }).shipped_at === "string"
      ? (prev as { shipped_at: string }).shipped_at
      : nowIso;

  const payload = {
    order_id: data.order_id,
    carrier: data.carrier,
    tracking_number: data.tracking_number,
    tracking_url,
    status: "shipped" as const,
    shipped_at,
  };

  const { error: upsertErr } = await admin.from("shipments").upsert(payload, {
    onConflict: "order_id",
  });

  if (upsertErr) {
    log.warn({ err: upsertErr }, "admin-shipment: upsert");
    return res.status(500).json({ error: "Shipment save failed" });
  }

  await maybeSendCustomerShipmentNotification({ admin, orderId: data.order_id });

  return res.status(200).json({ ok: true });
}
