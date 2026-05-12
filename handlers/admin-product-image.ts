import type { IncomingMessage } from "node:http";
import { Readable } from "node:stream";
import busboy from "busboy";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import getRawBody from "raw-body";
import { z } from "zod";
import {
  PRODUCT_IMAGE_BUCKET_ID,
  PRODUCT_IMAGE_MAX_BYTES,
  isDeletableProductImageStoragePath,
} from "../src/domain/commerce/productImage";
import { ENV } from "./_lib/env";
import { log } from "./_lib/logger";
import { detectImageMimeFromMagicBytes } from "./_lib/shipmentImageBytes";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin";
import {
  getBearerAuthorizationHeader,
  verifyAdminJwt,
} from "./_lib/verifyAdminJwt";

export const config = { api: { bodyParser: false } };

const productIdField = z.string().uuid().optional();

type ParsedMultipart = {
  product_id: string | undefined;
  file: Buffer | undefined;
  fileTooLarge: boolean;
  fileParseError: string | undefined;
};

function cors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", ENV.FRONTEND_URL);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS");
}

async function readBodyBuffer(req: VercelRequest, byteLimit: number): Promise<Buffer> {
  const b = req.body;
  if (Buffer.isBuffer(b)) return b;
  if (typeof b === "string") return Buffer.from(b, "latin1");
  return getRawBody(req as IncomingMessage, { limit: byteLimit });
}

function parseMultipart(req: VercelRequest, raw: Buffer): Promise<ParsedMultipart> {
  return new Promise((resolve, reject) => {
    const out: ParsedMultipart = {
      product_id: undefined,
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
          fileSize: PRODUCT_IMAGE_MAX_BYTES,
        },
      });
      const chunks: Buffer[] = [];

      bb.on("field", (name, val) => {
        if (name === "product_id") out.product_id = val;
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
        if (chunks.length > 0) out.file = Buffer.concat(chunks);
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

function queryParam(query: VercelRequest["query"], key: string): string {
  const raw = query[key];
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];
  return "";
}

async function verifyAdmin(req: VercelRequest, res: VercelResponse): Promise<boolean> {
  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
    res.status(503).json({ error: "Auth verification not configured" });
    return false;
  }

  const token = getBearerAuthorizationHeader(req.headers.authorization);
  if (!token) {
    res.status(401).json({ error: "Missing Authorization Bearer" });
    return false;
  }

  const verified = await verifyAdminJwt(token);
  if (!verified) {
    res.status(403).json({ error: "Admin role required or invalid session" });
    return false;
  }

  return true;
}

async function handlePost(req: VercelRequest, res: VercelResponse) {
  const ct = req.headers["content-type"];
  if (typeof ct !== "string" || !ct.toLowerCase().includes("multipart/form-data")) {
    return res.status(400).json({ error: "Expected multipart/form-data" });
  }

  const rawLimit = PRODUCT_IMAGE_MAX_BYTES + 512 * 1024;
  let raw: Buffer;
  try {
    raw = await readBodyBuffer(req, rawLimit);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("max") || msg.includes("limit") || msg.includes("length")) {
      return res.status(413).json({ error: "Upload too large" });
    }
    log.warn({ err }, "admin-product-image: read body");
    return res.status(400).json({ error: "Could not read upload" });
  }

  let parsed: ParsedMultipart;
  try {
    parsed = await parseMultipart(req, raw);
  } catch (err: unknown) {
    log.warn({ err }, "admin-product-image: multipart");
    return res.status(400).json({ error: "Invalid multipart body" });
  }

  if (parsed.fileParseError) {
    return res.status(400).json({ error: "Invalid multipart body" });
  }
  if (parsed.fileTooLarge) {
    return res.status(413).json({ error: "File exceeds size limit" });
  }
  if (!parsed.file || parsed.file.length === 0) {
    return res.status(400).json({ error: "Missing image file" });
  }

  const productIdRaw = typeof parsed.product_id === "string" ? parsed.product_id.trim() : "";
  if (productIdRaw && !productIdField.safeParse(productIdRaw).success) {
    return res.status(400).json({ error: "Invalid product_id" });
  }

  const detected = detectImageMimeFromMagicBytes(parsed.file);
  if (!detected) {
    return res.status(400).json({ error: "Unsupported or corrupt image file" });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: "Storage not configured" });
  }

  const owner = productIdRaw ? `products/${productIdRaw}` : "draft";
  const objectPath = `${owner}/${crypto.randomUUID()}.${detected.ext}`;

  const { error: upErr } = await admin.storage
    .from(PRODUCT_IMAGE_BUCKET_ID)
    .upload(objectPath, parsed.file, {
      contentType: detected.mime,
      upsert: false,
    });

  if (upErr) {
    log.warn({ err: upErr }, "admin-product-image: storage upload");
    return res.status(500).json({ error: "Image upload failed" });
  }

  const publicUrl = admin.storage
    .from(PRODUCT_IMAGE_BUCKET_ID)
    .getPublicUrl(objectPath)
    .data.publicUrl;

  return res.status(201).json({
    object_path: objectPath,
    preview_url: publicUrl,
    mime: detected.mime,
  });
}

async function handleDelete(req: VercelRequest, res: VercelResponse) {
  const objectPath = queryParam(req.query, "object_path").trim();
  if (!isDeletableProductImageStoragePath(objectPath)) {
    return res.status(400).json({ error: "Invalid or missing object_path" });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: "Storage not configured" });
  }

  const { error } = await admin.storage.from(PRODUCT_IMAGE_BUCKET_ID).remove([objectPath]);
  if (error) {
    log.warn({ err: error }, "admin-product-image: storage delete");
    return res.status(500).json({ error: "Image delete failed" });
  }

  return res.status(200).json({ ok: true });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!(await verifyAdmin(req, res))) {
    return;
  }

  if (req.method === "POST") return handlePost(req, res);
  return handleDelete(req, res);
}
