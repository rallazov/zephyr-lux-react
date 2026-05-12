import { describe, expect, it } from "vitest";
import { resolveProductImageUrl } from "./productImageUrl";

describe("resolveProductImageUrl", () => {
  it("keeps committed local asset paths unchanged", () => {
    expect(resolveProductImageUrl("/assets/img/product.jpg", "https://project.supabase.co")).toBe(
      "/assets/img/product.jpg",
    );
  });

  it("keeps absolute external URLs unchanged", () => {
    expect(resolveProductImageUrl("https://cdn.example.com/x.jpg", "https://project.supabase.co")).toBe(
      "https://cdn.example.com/x.jpg",
    );
  });

  it("resolves Supabase object paths to public product image URLs", () => {
    expect(resolveProductImageUrl("products/abc/a b.png", "https://project.supabase.co")).toBe(
      "https://project.supabase.co/storage/v1/object/public/product-images/products/abc/a%20b.png",
    );
  });

  it("accepts object paths that include the bucket prefix", () => {
    expect(resolveProductImageUrl("product-images/products/abc/x.webp", "https://project.supabase.co/")).toBe(
      "https://project.supabase.co/storage/v1/object/public/product-images/products/abc/x.webp",
    );
  });

  it("returns empty string for missing image paths", () => {
    expect(resolveProductImageUrl("", "https://project.supabase.co")).toBe("");
    expect(resolveProductImageUrl(null, "https://project.supabase.co")).toBe("");
  });
});
