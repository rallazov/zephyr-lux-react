import { describe, expect, it } from "vitest";
import type { ProductVariant } from "../../domain/commerce";
import { computeOptionLayout } from "./variantSelection";
import { pdpCtaState } from "./pdpCta";

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

describe("pdpCtaState", () => {
  it("2D incomplete: key copy off missing size vs missing color", () => {
    const allVariants: ProductVariant[] = [
      baseV({ sku: "1", size: "M", color: "black" }),
      baseV({ sku: "2", size: "L", color: "blue" }),
    ];
    const purchasable = allVariants;
    const layout = computeOptionLayout(purchasable);
    expect(layout.showSize && layout.showColor).toBe(true);

    const both = pdpCtaState(purchasable, layout, allVariants, null, null);
    expect(both.text).toBe("Select a size and color");

    const sizeOnly = pdpCtaState(purchasable, layout, allVariants, "M", null);
    expect(sizeOnly.text).toBe("Select a color");
    expect(sizeOnly.hint).toMatch(/color/i);

    const colorFirst = pdpCtaState(purchasable, layout, allVariants, null, "black");
    expect(colorFirst.text).toBe("Select a size");
  });
});
