import { describe, expect, it } from "vitest";
import { normalizeLineSku, sameCartLine } from "./lineKey";

describe("lineKey", () => {
  it("treats missing and empty sku as one bucket", () => {
    expect(normalizeLineSku(undefined)).toBe("");
    expect(normalizeLineSku("")).toBe("");
    expect(
      sameCartLine({ id: 1, sku: undefined }, { id: 1, sku: "" })
    ).toBe(true);
  });

  it("distinguishes different skus for same product id", () => {
    expect(
      sameCartLine({ id: 101, sku: "A" }, { id: 101, sku: "B" })
    ).toBe(false);
  });
});
