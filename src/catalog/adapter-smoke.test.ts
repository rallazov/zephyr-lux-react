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
  expect(underwear.map((l) => l.product.slug)).toEqual(
    expect.arrayContaining(["boxer-briefs", "boxer-briefs-long-leg"]),
  );
  const women = await adapter.listProductsByCategory("women");
  expect(women.map((l) => l.product.slug)).toContain("silk-relaxed-shell");
});

it("listProducts returns bundled active rows with list invariants", async () => {
  const adapter = getDefaultCatalogAdapter();
  const list = await adapter.listProducts();
  const slugs = list.map((l) => l.product.slug);
  expect(slugs).toEqual(
    expect.arrayContaining(["boxer-briefs", "boxer-briefs-long-leg"]),
  );
  expect(
    list.every(
      (l) => l.product.status === "active" || l.product.status === "coming_soon",
    ),
  ).toBe(true);
  expect(
    list.every(
      (l) =>
        typeof l.purchasableVariantCount === "number" &&
        l.purchasableVariantCount >= 0
    )
  ).toBe(true);
});

it("men's boxer PDP exposes multi-image gallery from bundled assets", async () => {
  const adapter = getDefaultCatalogAdapter();
  const shortRow = await adapter.getProductBySlug("boxer-briefs");
  const longRow = await adapter.getProductBySlug("boxer-briefs-long-leg");
  expect(shortRow?.galleryImages.length).toBe(8);
  expect(shortRow?.displayGalleryUrls.length).toBe(8);
  expect(longRow?.galleryImages.length).toBe(8);
  expect(longRow?.displayGalleryUrls[0]).toBe("/assets/img/long leg.jpg");
});
