import type { IncomingMessage } from "node:http";
import { Readable } from "node:stream";
import busboy from "busboy";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import getRawBody from "raw-body";

/** Multipart must be read raw; Vercel’s default body parser breaks `busboy` piping. */
export const config = { api: { bodyParser: false } };
import { z } from "zod";
import {
  SHIPMENT_IMAGE_MAX_BYTES,
  shipmentImageTypeSchema,
} from "../src/domain/commerce/shipmentImage";
import { ENV } from "./_lib/env";
import { log } from "./_lib/logger";
import { detectImageMimeFromMagicBytes } from "./_lib/shipmentImageBytes";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin";
import {
  getBearerAuthorizationHeader,
  verifyAdminJwt,
} from "./_lib/verifyAdminJwt";

const BUCKET_ID = "shipment-images";

/** POST multipart: fields `order_id`, `image_type`; file field `file`. Max 4 MiB (fits Vercel limits). */

function cors (res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", ENV.FRONTEND_URL);
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

const orderIdField = z.string().uuid();

async function readBodyBuffer (
  req: VercelRequest,
  byteLimit: number,
): Promise<Buffer> {
  const b = req.body;
  if (Buffer.isBuffer(b)) {
    return b;
  }
  if (typeof b === "string") {
    return Buffer.from(b, "latin1");
  }
  return getRawBody(req as IncomingMessage, { limit: byteLimit });
}

type ParsedMultipart = {
  order_id: string | undefined;
  image_type: string | undefined;
  file: Buffer | undefined;
  fileTooLarge: boolean;
  fileParseError: string | undefined;
};

function parseMultipart (
  req: VercelRequest,
  raw: Buffer,
): Promise<ParsedMultipart> {
  return new Promise((resolve, reject) => {
    const out: ParsedMultipart = {
      order_id: undefined,
      image_type: undefined,
      file: undefined,
      fileTooLarge: false,
      fileParseError: undefined,
    };

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(out);
    };

    try {
      const bb = busboy({
        headers: req.headers,
        limits: {
          files: 1,
          fileSize: SHIPMENT_IMAGE_MAX_BYTES,
        },
      });

      const chunks: Buffer[] = [];

      bb.on("field", (name, val) => {
        if (name === "order_id") out.order_id = val;
        if (name === "image_type") out.image_type = val;
      });

      bb.on("file", (_field, file) => {
        file.on("data", (d: Buffer) => {
          chunks.push(d);
        });
        file.on("limit", () => {
          out.fileTooLarge = true;
          file.resume();
        });
      });

      bb.on("error", (err: Error) => {
        if (!settled) {
          settled = true;
          out.fileParseError = err.message;
          resolve(out);
        }
      });

      bb.on("finish", () => {
        if (out.fileTooLarge) {
          finish();
          return;
        }
        if (chunks.length > 0) {
          out.file = Buffer.concat(chunks);
        }
        finish();
      });

      Readable.from(raw).pipe(bb);
    } catch (err: unknown) {
      if (!settled) {
        settled = true;
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    }
  });
}

export default async function handler (req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ct = req.headers["content-type"];
  if (typeof ct !== "string" || !ct.toLowerCase().includes("multipart/form-data")) {
    return res.status(400).json({ error: "Expected multipart/form-data" });
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

  const rawLimit = SHIPMENT_IMAGE_MAX_BYTES + 512 * 1024;
  let raw: Buffer;
  try {
    raw = await readBodyBuffer(req, rawLimit);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("max") || msg.includes("limit") || msg.includes("length")) {
      return res.status(413).json({ error: "Upload too large" });
    }
    log.warn({ err }, "admin-shipment-image: read body");
    return res.status(400).json({ error: "Could not read upload" });
  }

  let parsed: ParsedMultipart;
  try {
    parsed = await parseMultipart(req, raw);
  } catch (err: unknown) {
    log.warn({ err }, "admin-shipment-image: multipart");
    return res.status(400).json({ error: "Invalid multipart body" });
  }

  if (parsed.fileParseError) {
    return res.status(400).json({ error: "Invalid multipart body" });
  }

  if (parsed.fileTooLarge) {
    return res.status(413).json({ error: "File exceeds size limit" });
  }

  const orderParse = orderIdField.safeParse(
    typeof parsed.order_id === "string" ? parsed.order_id.trim() : "",
  );
  if (!orderParse.success) {
    return res.status(400).json({ error: "Invalid or missing order_id" });
  }
  const orderId = orderParse.data;

  const imageTypeParse = shipmentImageTypeSchema.safeParse(
    typeof parsed.image_type === "string" ? parsed.image_type.trim() : "",
  );
  if (!imageTypeParse.success) {
    return res.status(400).json({ error: "Invalid image_type" });
  }
  const imageType = imageTypeParse.data;

  if (!parsed.file || parsed.file.length === 0) {
    return res.status(400).json({ error: "Missing image file" });
  }

  const detected = detectImageMimeFromMagicBytes(parsed.file);
  if (!detected) {
    return res.status(400).json({ error: "Unsupported or corrupt image file" });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: "Storage not configured" });
  }

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("id, payment_status, fulfillment_status")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !order) {
    log.warn({ err: orderErr }, "admin-shipment-image: order");
    return res.status(404).json({ error: "Order not found" });
  }

  const o = order as {
    payment_status: string;
    fulfillment_status: string;
  };

  if (o.payment_status !== "paid" || o.fulfillment_status !== "shipped") {
    return res.status(400).json({
      error: "Shipment photos require paid orders in Shipped fulfillment",
    });
  }

  const { data: ship, error: shipErr } = await admin
    .from("shipments")
    .select("id, order_id")
    .eq("order_id", orderId)
    .maybeSingle();

  if (shipErr || !ship || typeof (ship as { id?: string }).id !== "string") {
    log.warn({ err: shipErr }, "admin-shipment-image: shipment");
    return res.status(400).json({
      error: "No shipment record for this order — save tracking first",
    });
  }

  const shipmentId = (ship as { id: string }).id;

  const objectPath = `${orderId}/${crypto.randomUUID()}.${detected.ext}`;

  const { error: upErr } = await admin.storage
    .from(BUCKET_ID)
    .upload(objectPath, parsed.file, {
      contentType: detected.mime,
      upsert: false,
    });

  if (upErr) {
    log.warn({ err: upErr }, "admin-shipment-image: storage upload");
    return res.status(500).json({ error: "Image upload failed" });
  }

  const { data: row, error: insErr } = await admin
    .from("shipment_images")
    .insert({
      shipment_id: shipmentId,
      order_id: orderId,
      storage_path: objectPath,
      image_type: imageType,
    })
    .select("id, created_at, image_type, storage_path")
    .maybeSingle();

  if (insErr || !row) {
    log.warn({ err: insErr }, "admin-shipment-image: insert");
    await admin.storage.from(BUCKET_ID).remove([objectPath]);
    return res.status(500).json({ error: "Could not save image record" });
  }

  const r = row as {
    id: string;
    created_at: string;
    image_type: string;
    storage_path: string;
  };

  return res.status(201).json({
    id: r.id,
    created_at: r.created_at,
    image_type: r.image_type,
  });
}
