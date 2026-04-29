import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { shipmentImageTypeSchema } from "../src/domain/commerce/shipmentImage";
import { ENV } from "./_lib/env";
import { log } from "./_lib/logger";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin";
import {
  getBearerAuthorizationHeader,
  verifyAdminJwt,
} from "./_lib/verifyAdminJwt";

const BUCKET_ID = "shipment-images";

/** Short-lived signed URLs for admin previews only (NFR-SEC-006). */
export const SHIPMENT_IMAGE_SIGNED_URL_TTL_SEC = 300;

function cors (res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", ENV.FRONTEND_URL);
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
}

function queryParam (query: VercelRequest["query"], key: string): string {
  const raw = query[key];
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];
  return "";
}

const orderIdQuery = z.string().uuid();

export default async function handler (req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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

  const q = orderIdQuery.safeParse(queryParam(req.query, "order_id").trim());
  if (!q.success) {
    return res.status(400).json({ error: "Invalid or missing order_id" });
  }
  const orderId = q.data;

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: "Listing not configured" });
  }

  const { data: rows, error } = await admin
    .from("shipment_images")
    .select("id, image_type, created_at, storage_path")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) {
    log.warn({ err: error }, "admin-shipment-images: select");
    return res.status(500).json({ error: "Could not list images" });
  }

  const list = Array.isArray(rows) ? rows : [];
  const items: {
    id: string;
    image_type: z.infer<typeof shipmentImageTypeSchema>;
    created_at: string;
    preview_url: string | null;
  }[] = [];

  for (const rawRow of list) {
    const row = rawRow as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id : "";
    const created_at = typeof row.created_at === "string" ? row.created_at : "";
    const storage_path = typeof row.storage_path === "string" ? row.storage_path : "";
    const it = shipmentImageTypeSchema.safeParse(row.image_type);
    if (!id || !created_at || !storage_path || !it.success) {
      continue;
    }

    const { data: signed, error: signErr } = await admin.storage
      .from(BUCKET_ID)
      .createSignedUrl(storage_path, SHIPMENT_IMAGE_SIGNED_URL_TTL_SEC);

    if (signErr) {
      log.warn({ err: signErr }, "admin-shipment-images: signed url");
    }

    items.push({
      id,
      image_type: it.data,
      created_at,
      preview_url: signed?.signedUrl ?? null,
    });
  }

  return res.status(200).json({ items });
}
