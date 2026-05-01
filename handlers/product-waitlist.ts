import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ENV } from "./_lib/env";
import { log } from "./_lib/logger";
import {
  normalizedWaitlistEmail,
  PRODUCT_WAITLIST_ACK_MESSAGE,
  productWaitlistBodySchema,
} from "./_lib/productWaitlist";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin";

function cors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", ENV.FRONTEND_URL);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const parsed = productWaitlistBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const email = normalizedWaitlistEmail(parsed.data.email);
  const productId = parsed.data.product_id;

  const admin = getSupabaseAdmin();
  if (!admin) {
    log.warn("product_waitlist: persistence not configured — returning acknowledgement only");
    res.status(202).json({ message: PRODUCT_WAITLIST_ACK_MESSAGE });
    return;
  }

  try {
    const { data: row, error: fetchErr } = await admin
      .from("products")
      .select("status")
      .eq("id", productId)
      .maybeSingle();

    if (
      fetchErr ||
      !row ||
      typeof row.status !== "string" ||
      row.status !== "coming_soon"
    ) {
      res.status(202).json({ message: PRODUCT_WAITLIST_ACK_MESSAGE });
      return;
    }

    const { error: insertErr } = await admin.from("product_waitlist_signups").upsert(
      {
        product_id: productId,
        email,
      },
      {
        onConflict: "product_id,email",
        ignoreDuplicates: true,
      },
    );

    if (insertErr) {
      log.warn({ err: insertErr }, "product_waitlist: insert skipped or failed — returning acknowledgement");
    }
    res.status(202).json({ message: PRODUCT_WAITLIST_ACK_MESSAGE });
  } catch (err) {
    log.error({ err }, "product_waitlist: unexpected error — returning acknowledgement");
    res.status(202).json({ message: PRODUCT_WAITLIST_ACK_MESSAGE });
  }
}
