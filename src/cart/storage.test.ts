import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StorefrontCartLine } from "./cartLine";
import {
  CART_LOCAL_STORAGE_KEY,
  readCartFromLocalStorage,
  writeCartToLocalStorage,
} from "./storage";

describe("cart storage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("migrates legacy flat array to versioned read path", () => {
    const legacy: StorefrontCartLine[] = [
      {
        id: 101,
        name: "Test",
        quantity: 2,
        price: 10,
        image: "/x.jpg",
        sku: "ABC",
      },
    ];
    localStorage.setItem(CART_LOCAL_STORAGE_KEY, JSON.stringify(legacy));
    const read = readCartFromLocalStorage();
    expect(read).toEqual(legacy);
  });

  it("reads versioned payload", () => {
    writeCartToLocalStorage([
      {
        id: 1,
        name: "A",
        quantity: 1,
        price: 5,
        image: "",
        sku: "S",
        product_slug: "a",
      },
    ]);
    expect(readCartFromLocalStorage()).toHaveLength(1);
    expect(readCartFromLocalStorage()[0].sku).toBe("S");
  });

  it("returns empty cart and warns on invalid JSON", () => {
    localStorage.setItem(CART_LOCAL_STORAGE_KEY, "not-json");
    expect(readCartFromLocalStorage()).toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });

  it("returns empty cart on unknown version", () => {
    localStorage.setItem(
      CART_LOCAL_STORAGE_KEY,
      JSON.stringify({ v: 99, items: [] })
    );
    expect(readCartFromLocalStorage()).toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });
});
