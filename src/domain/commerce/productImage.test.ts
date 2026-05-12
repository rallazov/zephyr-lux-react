import { describe, expect, it } from "vitest";
import { isDeletableProductImageStoragePath } from "./productImage";

describe("isDeletableProductImageStoragePath", () => {
  it("accepts draft/ and products/ uploads", () => {
    expect(isDeletableProductImageStoragePath("draft/x.png")).toBe(true);
    expect(isDeletableProductImageStoragePath("products/550e8400-e29b-41d4-a716-446655440000/foo.webp")).toBe(true);
  });

  it("rejects site paths and absolute URLs", () => {
    expect(isDeletableProductImageStoragePath("/assets/img/x.jpg")).toBe(false);
    expect(isDeletableProductImageStoragePath("https://x.example/img.png")).toBe(false);
  });

  it("rejects path traversal", () => {
    expect(isDeletableProductImageStoragePath("products/../evil.png")).toBe(false);
  });

  it("rejects prefixes outside draft/products", () => {
    expect(isDeletableProductImageStoragePath("other/x.png")).toBe(false);
  });
});
