import { describe, expect, it } from "vitest";
import type { ProductVariant } from "../../domain/commerce";
import {
  computeOptionLayout,
  getPurchasableVariants,
  lowStockMessage,
  resolveSelection,
} from "./variantSelection";

const baseV = (o: Partial<ProductVariant> & { sku: string }): ProductVariant => ({
  sku: o.sku,
  size: o.size,
  color: o.color,
  price_cents: o.price_cents ?? 2000,
  currency: "USD",
  inventory_quantity: o.inventory_quantity ?? 5,
  status: o.status ?? "active",
  image_url: o.image_url,
  low_stock_threshold: o.low_stock_threshold,
});

describe("variantSelection", () => {
  it("excludes OOS and inactive from purchasable", () => {
    const vs: ProductVariant[] = [
      baseV({ sku: "a", size: "M", color: "black", inventory_quantity: 0 }),
      baseV({ sku: "b", size: "L", color: "black" }),
    ];
    expect(getPurchasableVariants(vs).map((v) => v.sku)).toEqual(["b"]);
  });

  it("2D: requires size and color before resolving a purchasable row", () => {
    const purchasable: ProductVariant[] = [
      baseV({ sku: "1", size: "M", color: "black" }),
      baseV({ sku: "2", size: "L", color: "blue" }),
    ];
    const layout = computeOptionLayout(purchasable);
    expect(layout.showSize && layout.showColor).toBe(true);
    const r0 = resolveSelection(purchasable, purchasable, layout, {
      size: null,
      color: null,
    });
    expect(r0.kind).toBe("incomplete");
    const r1 = resolveSelection(purchasable, purchasable, layout, {
      size: "M",
      color: null,
    });
    expect(r1.kind).toBe("incomplete");
    const r2 = resolveSelection(purchasable, purchasable, layout, {
      size: "M",
      color: "black",
    });
    expect(r2.kind).toBe("purchasable");
    if (r2.kind === "purchasable") {
      expect(r2.variant.sku).toBe("1");
    }
  });

  it("auto-selects when exactly one purchasable variant", () => {
    const purchasable = [baseV({ sku: "x", size: "M", color: "black" })];
    const layout = computeOptionLayout(purchasable);
    expect(layout.autoSelectSingle).toBe(true);
    const r = resolveSelection(purchasable, purchasable, layout, {
      size: null,
      color: null,
    });
    expect(r.kind).toBe("purchasable");
  });

  it("low stock message when within threshold", () => {
    const v = baseV({
      sku: "x",
      inventory_quantity: 3,
      low_stock_threshold: 5,
    });
    expect(lowStockMessage(v)).toContain("3");
  });

  it("size-only layout with null/absent colors resolves exactly one purchasable SKU per size", () => {
    const all: ProductVariant[] = [
      baseV({ sku: "ZLX-2PK-S", size: "S", color: undefined }),
      baseV({ sku: "ZLX-2PK-M", size: "M", color: undefined }),
      baseV({
        sku: "ZLX-2PK-L",
        size: "L",
        color: undefined,
        inventory_quantity: 3,
        low_stock_threshold: 5,
      }),
      baseV({ sku: "ZLX-2PK-XL", size: "XL", color: undefined }),
    ];
    const purchasable = getPurchasableVariants(all);
    const layout = computeOptionLayout(purchasable);
    expect(layout.showSize).toBe(true);
    expect(layout.showColor).toBe(false);
    for (const size of ["S", "M", "L", "XL"] as const) {
      const r = resolveSelection(all, purchasable, layout, { size, color: null });
      expect(r.kind).toBe("purchasable");
      if (r.kind === "purchasable") {
        expect(r.variant.size).toBe(size);
        expect(r.variant.sku).toBe(`ZLX-2PK-${size}`);
      }
    }
  });
});
