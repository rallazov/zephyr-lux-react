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

/** Sync handler + outer try/catch so nothing escapes as an unhandled rejection (FUNCTION_INVOCATION_FAILED). */
export default function handler(req: VercelRequest, res: VercelResponse): void {
  try {
    cors(res);
    if (req.method === "OPTIONS") {
      res.status(200).end();
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        code: "INVALID_BODY",
        error: "Invalid request body",
        details: z.treeifyError(parsed.error),
      });
      return;
    }
    const { items } = parsed.data;
    try {
      const q = quoteCartLines(items);
      res.status(200).json(q);
    } catch (e) {
      if (isQuoteError(e)) {
        res.status(400).json({ code: e.code, error: e.message });
        return;
      }
      log.error({ err: e }, "cart-quote failed");
      res.status(500).json({ error: "Could not get price quote. Please try again." });
    }
  } catch (fatal) {
    console.error("cart-quote fatal", fatal);
    if (!res.headersSent) {
      res.status(500).json({ error: "Could not get price quote. Please try again." });
    }
  }
}
