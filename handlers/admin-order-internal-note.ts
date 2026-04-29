import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { ENV, isSupabaseOrderPersistenceConfigured } from "./_lib/env";
import { log } from "./_lib/logger";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin";
import { getBearerAuthorizationHeader, verifyAdminJwt } from "./_lib/verifyAdminJwt";

/** Must match `append_order_internal_note` in migrations. */
export const INTERNAL_NOTE_MAX_CHARS = 8000;

const bodySchema = z.object({
  order_id: z.string().uuid(),
  message: z.string(),
});

function cors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", ENV.FRONTEND_URL);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

/** Raised by Postgres as `RAISE EXCEPTION 'append_order_internal_note: <fault>'` (migration). */
type AppendInternalNoteFault = "order_not_found" | "empty_message" | "message_too_long";

/** PostgREST can surface Postgres text in message, hint, details, or a combination — avoid mapping on `message` alone. */
function extractAppendInternalNoteFault(raw: {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}): AppendInternalNoteFault | null {
  const bundle = [raw.message, raw.details, raw.hint]
    .filter((x): x is string => typeof x === "string" && x.trim() !== "")
    .join("\n");
  const m =
    /\b(?:append_order_internal_note:\s*)?(order_not_found|empty_message|message_too_long)\b/i.exec(bundle);
  return m?.[1] ? (m[1] as AppendInternalNoteFault) : null;
}

function mapRpcError(err: {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}): {
  status: number;
  error: string;
} {
  const fault = extractAppendInternalNoteFault(err);
  if (fault === "order_not_found") {
    return { status: 404, error: "Order not found" };
  }
  if (fault === "empty_message") {
    return { status: 400, error: "Note text is required." };
  }
  if (fault === "message_too_long") {
    return {
      status: 400,
      error: `Note is too long (max ${INTERNAL_NOTE_MAX_CHARS} characters).`,
    };
  }
  return { status: 500, error: "Could not save internal note" };
}

/**
 * Admin-only POST `{ order_id, message }`.
 * Persists via `append_order_internal_note` RPC; actor id from verified JWT only.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
    log.warn("admin-order-internal-note: missing Supabase URL or anon key for JWT verify");
    return res.status(503).json({ error: "Internal notes API not configured" });
  }

  if (!isSupabaseOrderPersistenceConfigured()) {
    return res.status(503).json({ error: "Internal notes API not configured" });
  }

  const adminClient = getSupabaseAdmin();
  if (!adminClient) {
    return res.status(503).json({ error: "Internal notes not available" });
  }

  const token = getBearerAuthorizationHeader(req.headers.authorization);
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

  const trimmed = parsed.data.message.trim();
  if (!trimmed) {
    return res.status(400).json({ error: "Note text is required." });
  }
  if (trimmed.length > INTERNAL_NOTE_MAX_CHARS) {
    return res.status(400).json({
      error: `Note is too long (max ${INTERNAL_NOTE_MAX_CHARS} characters).`,
    });
  }

  const orderId = parsed.data.order_id;

  try {
    const { data, error } = await adminClient.rpc("append_order_internal_note", {
      p_order_id: orderId,
      p_message: trimmed,
      p_actor_user_id: verified.userId,
    });

    if (error) {
      const mapped = mapRpcError(error);
      if (mapped.status === 500) {
        log.warn({ err: error, order_id: orderId }, "admin-order-internal-note: rpc error");
      }
      return res.status(mapped.status).json({ error: mapped.error });
    }

    return res.status(200).json({ ok: true, ...(data as object) });
  } catch (err: unknown) {
    log.error({ err, order_id: orderId }, "admin-order-internal-note failed");
    return res.status(500).json({ error: "Could not save internal note" });
  }
}
