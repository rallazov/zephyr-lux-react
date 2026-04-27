import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "./logger";

export async function applyInventoryForPaidOrder(
  admin: SupabaseClient,
  orderId: string,
): Promise<{ ok: true } | { ok: false }> {
  const { error } = await admin.rpc("apply_order_paid_inventory", {
    p_order_id: orderId,
  });

  if (error) {
    log.warn(
      { orderId, message: error.message },
      "applyInventoryForPaidOrder: apply_order_paid_inventory failed — webhook will retry",
    );
    return { ok: false };
  }

  return { ok: true };
}
