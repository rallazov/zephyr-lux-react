// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyInventoryForPaidOrder } from "./applyInventoryForPaidOrder";

vi.mock("./logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("applyInventoryForPaidOrder", () => {
  it("returns ok when rpc succeeds", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as unknown as SupabaseClient;

    const r = await applyInventoryForPaidOrder(client, "order-uuid");
    expect(r).toEqual({ ok: true });
    expect(client.rpc).toHaveBeenCalledWith("apply_order_paid_inventory", {
      p_order_id: "order-uuid",
    });
  });

  it("returns not ok when rpc fails (e.g. unresolved SKU or insufficient stock)", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "apply_order_paid_inventory: insufficient_inventory sku=x need=1 have=0" },
      }),
    } as unknown as SupabaseClient;

    const r = await applyInventoryForPaidOrder(client, "order-uuid");
    expect(r).toEqual({ ok: false });
  });
});
