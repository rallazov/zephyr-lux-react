import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { isQuoteError, quoteCartLines } from "./_lib/catalog";
import { ENV } from "./_lib/env";
import { log } from "./_lib/logger";

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        sku: z.string().min(1, "sku is required"),
        quantity: z.coerce
          .number()
          .int("quantity must be an integer")
          .positive("quantity must be a positive integer"),
      }),
    )
    .min(1, "at least one line item is required"),
});

function cors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", ENV.FRONTEND_URL);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      code: "INVALID_BODY",
      error: "Invalid request body",
      details: z.treeifyError(parsed.error),
    });
  }
  const { items } = parsed.data;
  try {
    const q = quoteCartLines(items);
    return res.status(200).json(q);
  } catch (e) {
    if (isQuoteError(e)) {
      if (e.code === "UNKNOWN_SKU") {
        return res.status(400).json({ code: e.code, error: e.message });
      }
      return res.status(400).json({ code: e.code, error: e.message });
    }
    log.error({ err: e }, "cart-quote failed");
    return res.status(500).json({ error: "Could not get price quote. Please try again." });
  }
}
