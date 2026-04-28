import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  ORDER_LOOKUP_NEUTRAL_MESSAGE,
  parseOrderLookupRequest,
} from "../src/order-status/orderLookupRequest";
import { processOrderLookupLinkRequest } from "./_lib/customerOrderLookupLink";
import { ENV } from "./_lib/env";
import { log } from "./_lib/logger";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin";

function cors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", ENV.FRONTEND_URL);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const parsed = parseOrderLookupRequest(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid lookup request" });
  }

  try {
    const admin = getSupabaseAdmin();
    if (admin) {
      await processOrderLookupLinkRequest({
        admin,
        order_number: parsed.data.order_number,
        email: parsed.data.email,
      });
    } else {
      log.warn("order_lookup: persistence not configured — returning neutral response only");
    }
  } catch (err) {
    log.error({ err }, "order_lookup: request processing failed — returning neutral response");
  }

  return res.status(202).json({ message: ORDER_LOOKUP_NEUTRAL_MESSAGE });
}
