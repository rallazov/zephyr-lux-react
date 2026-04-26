import { describe, expect, it } from "vitest";
import { adminSaveBundleSchema, validateMergedProduct } from "./validation";

describe("adminSaveBundleSchema + validateMergedProduct", () => {
  it("rejects non-draft product with zero variants", () => {
    const p = {
      product: {
        slug: "a",
        title: "A",
        status: "active" as const,
      },
      variants: [] as { id: string; sku: string; price_cents: number; currency: string; inventory_quantity: number; status: "active" }[],
    };
    const b = adminSaveBundleSchema.safeParse(p);
    expect(b.success).toBe(true);
    if (b.success) {
      const d = validateMergedProduct(b.data);
      expect(d.success).toBe(false);
    }
  });

  it("accepts draft with no variants and merged domain parse", () => {
    const p = {
      product: {
        slug: "a",
        title: "A",
        status: "draft" as const,
      },
      variants: [] as { id: string; sku: string; price_cents: number; currency: string; inventory_quantity: number; status: "active" }[],
    };
    const b = adminSaveBundleSchema.safeParse(p);
    expect(b.success).toBe(true);
    if (b.success) {
      const d = validateMergedProduct(b.data);
      expect(d.success).toBe(true);
    }
  });

  it("accepts active product with at least one valid variant", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    const p = {
      product: { slug: "a", title: "A", status: "active" as const },
      variants: [
        {
          id,
          sku: "X-1",
          price_cents: 100,
          currency: "USD",
          inventory_quantity: 0,
          status: "active" as const,
        },
      ],
      images: [] as { id: string; storage_path: string }[],
    };
    const b = adminSaveBundleSchema.safeParse(p);
    expect(b.success).toBe(true);
    if (b.success) {
      const d = validateMergedProduct(b.data);
      expect(d.success).toBe(true);
    }
  });
});
