import { describe, expect, it } from "vitest";
import { parseStaticCatalogData } from "../catalog/parse";
import type { StorefrontCartLine } from "./cartLine";
import {
  isCartOkForCheckout,
  reconcileCartLines,
  resolveVariantForLine,
  syncCartLinesFromCatalog,
  validateStorefrontCartLines,
} from "./reconcile";

const list = parseStaticCatalogData([
  {
    id: 1,
    slug: "recon-product",
    title: "Recon",
    status: "active",
    variants: [
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        sku: "GOOD",
        price_cents: 1500,
        currency: "USD",
        inventory_quantity: 3,
        status: "active",
      },
      {
        sku: "BADSTATUS",
        price_cents: 1500,
        currency: "USD",
        inventory_quantity: 3,
        status: "discontinued",
      },
      {
        sku: "OOS",
        price_cents: 1000,
        currency: "USD",
        inventory_quantity: 0,
        status: "active",
      },
      {
        sku: "INACTIVE",
        price_cents: 1200,
        currency: "USD",
        inventory_quantity: 5,
        status: "inactive",
      },
    ],
  },
]).listItems;

describe("validateStorefrontCartLines", () => {
  it("accepts active in-stock variant and aligns with catalog price", () => {
    const lines: StorefrontCartLine[] = [
      {
        id: list[0].storefrontProductId,
        name: "Old name",
        quantity: 1,
        price: 9.99,
        image: "",
        sku: "GOOD",
        product_slug: "recon-product",
      },
    ];
    const v = validateStorefrontCartLines(lines, list);
    expect(v).toHaveLength(1);
    expect(v[0].issues).toHaveLength(0);
    expect(v[0].displayUnitPrice).toBe(15);
    expect(isCartOkForCheckout(v)).toBe(true);
  });

  it("flags unknown SKU with plain message", () => {
    const lines: StorefrontCartLine[] = [
      {
        id: list[0].storefrontProductId,
        name: "X",
        quantity: 1,
        price: 1,
        image: "",
        sku: "NOSUCH",
        product_slug: "recon-product",
      },
    ];
    const v = validateStorefrontCartLines(lines, list);
    expect(v[0].issues.some((i) => i.code === "unknown_sku")).toBe(true);
    expect(isCartOkForCheckout(v)).toBe(false);
  });

  it("flags discontinued variant", () => {
    const lines: StorefrontCartLine[] = [
      {
        id: list[0].storefrontProductId,
        name: "X",
        quantity: 1,
        price: 1,
        image: "",
        sku: "BADSTATUS",
        product_slug: "recon-product",
      },
    ];
    const v = validateStorefrontCartLines(lines, list);
    expect(v[0].issues.some((i) => i.code === "variant_unavailable")).toBe(true);
    expect(isCartOkForCheckout(v)).toBe(false);
  });

  it("flags inactive variant", () => {
    const lines: StorefrontCartLine[] = [
      {
        id: list[0].storefrontProductId,
        name: "X",
        quantity: 1,
        price: 1,
        image: "",
        sku: "INACTIVE",
        product_slug: "recon-product",
      },
    ];
    const v = validateStorefrontCartLines(lines, list);
    expect(v[0].issues.some((i) => i.code === "variant_unavailable")).toBe(true);
    expect(
      v[0].issues.some((i) => i.message.includes("not available for purchase"))
    ).toBe(true);
    expect(isCartOkForCheckout(v)).toBe(false);
  });

  it("flags out-of-stock active variant", () => {
    const lines: StorefrontCartLine[] = [
      {
        id: list[0].storefrontProductId,
        name: "X",
        quantity: 1,
        price: 1,
        image: "",
        sku: "OOS",
        product_slug: "recon-product",
      },
    ];
    const v = validateStorefrontCartLines(lines, list);
    expect(v[0].issues.some((i) => i.code === "out_of_stock")).toBe(true);
    expect(isCartOkForCheckout(v)).toBe(false);
  });

  it("flags quantity over stock", () => {
    const lines: StorefrontCartLine[] = [
      {
        id: list[0].storefrontProductId,
        name: "X",
        quantity: 10,
        price: 15,
        image: "",
        sku: "GOOD",
        product_slug: "recon-product",
      },
    ];
    const v = validateStorefrontCartLines(lines, list);
    expect(v[0].issues.some((i) => i.code === "quantity_exceeds_stock")).toBe(true);
    expect(isCartOkForCheckout(v)).toBe(false);
  });

  it("flags legacy multi-variant line without SKU", () => {
    const lines: StorefrontCartLine[] = [
      {
        id: list[0].storefrontProductId,
        name: "Legacy",
        quantity: 1,
        price: 1,
        image: "",
        product_slug: "recon-product",
      },
    ];
    const v = validateStorefrontCartLines(lines, list);
    expect(v[0].issues.some((i) => i.code === "missing_variant")).toBe(true);
    expect(isCartOkForCheckout(v)).toBe(false);
  });

  it("flags unknown product id", () => {
    const lines: StorefrontCartLine[] = [
      {
        id: 99999,
        name: "Ghost",
        quantity: 1,
        price: 1,
        image: "",
        sku: "GOOD",
      },
    ];
    const v = validateStorefrontCartLines(lines, list);
    expect(v[0].issues.some((i) => i.code === "unknown_product")).toBe(true);
  });
});

describe("syncCartLinesFromCatalog", () => {
  it("updates price and variant_id without removing lines", () => {
    const lines: StorefrontCartLine[] = [
      {
        id: list[0].storefrontProductId,
        name: "Old name",
        quantity: 1,
        price: 9.99,
        image: "",
        sku: "GOOD",
        product_slug: "recon-product",
      },
    ];
    const { lines: next, priceUpdated } = syncCartLinesFromCatalog(lines, list);
    expect(next).toHaveLength(1);
    expect(priceUpdated).toBe(true);
    expect(next[0].price).toBe(15);
    expect(next[0].variant_id).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("keeps unknown SKU line in cart (no removal)", () => {
    const lines: StorefrontCartLine[] = [
      {
        id: list[0].storefrontProductId,
        name: "X",
        quantity: 1,
        price: 1,
        image: "",
        sku: "NOSUCH",
        product_slug: "recon-product",
      },
    ];
    const { lines: next } = syncCartLinesFromCatalog(lines, list);
    expect(next).toHaveLength(1);
    expect(next[0].sku).toBe("NOSUCH");
  });
});

describe("reconcileCartLines (sync wrapper)", () => {
  it("reports removedLineSlots as 0", () => {
    const lines: StorefrontCartLine[] = [];
    const r = reconcileCartLines(lines, list);
    expect(r.removedLineSlots).toBe(0);
  });
});

describe("resolveVariantForLine", () => {
  it("resolves single-variant product when SKU omitted", () => {
    const single = parseStaticCatalogData([
      {
        id: 2,
        slug: "solo",
        title: "Solo",
        status: "active",
        variants: [
          {
            sku: "ONLY",
            price_cents: 2000,
            currency: "USD",
            inventory_quantity: 5,
            status: "active",
          },
        ],
      },
    ]).listItems[0];
    const { variant, skuNorm, ambiguous } = resolveVariantForLine(
      {
        id: single.storefrontProductId,
        name: "S",
        quantity: 1,
        price: 20,
        image: "",
        product_slug: "solo",
      },
      single
    );
    expect(ambiguous).toBe(false);
    expect(skuNorm).toBe("ONLY");
    expect(variant?.sku).toBe("ONLY");
  });
});
