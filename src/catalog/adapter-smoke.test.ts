import { expect, it } from "vitest";
import { getDefaultCatalogAdapter } from "./factory";

it("static catalog resolves smoke slug", async () => {
  const adapter = getDefaultCatalogAdapter();
  const row = await adapter.getProductBySlug("boxer-briefs");
  expect(row).not.toBeNull();
  expect(row?.product.title).toContain("Boxer Briefs");
});

it("getProductBySlug returns null for unknown slug", async () => {
  const adapter = getDefaultCatalogAdapter();
  expect(
    await adapter.getProductBySlug("__no_such_slug_zlx__")
  ).toBeNull();
});

it("listProductsByCategory filters bundled underwear row", async () => {
  const adapter = getDefaultCatalogAdapter();
  const underwear = await adapter.listProductsByCategory("underwear");
  expect(underwear.map((l) => l.product.slug)).toContain("boxer-briefs");
  const women = await adapter.listProductsByCategory("women");
  expect(women).toHaveLength(0);
});

it("listProducts returns bundled active rows with list invariants", async () => {
  const adapter = getDefaultCatalogAdapter();
  const list = await adapter.listProducts();
  expect(list.map((l) => l.product.slug)).toContain("boxer-briefs");
  expect(list.every((l) => l.product.status === "active")).toBe(true);
  expect(
    list.every(
      (l) =>
        typeof l.purchasableVariantCount === "number" &&
        l.purchasableVariantCount >= 0
    )
  ).toBe(true);
});
