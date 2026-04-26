import type { StorefrontCartLine } from "./cartLine";
import { normalizeLineSku } from "./lineKey";

export const CART_LOCAL_STORAGE_KEY = "cartItems";

/** Versioned wrapper written to localStorage. */
export const CART_STORAGE_VERSION = 1 as const;

export type VersionedCartPayload = {
  v: typeof CART_STORAGE_VERSION;
  items: StorefrontCartLine[];
};

function warn(message: string): void {
  console.warn(`[cart storage] ${message}`);
}

function normalizeItem(raw: unknown): StorefrontCartLine | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = o.id;
  const name = o.name;
  const quantity = o.quantity;
  const price = o.price;
  const image = o.image;
  if (
    typeof id !== "number"
    || typeof name !== "string"
    || typeof quantity !== "number"
    || typeof price !== "number"
    || typeof image !== "string"
  ) {
    return null;
  }
  const sku = typeof o.sku === "string" ? o.sku : undefined;
  const variant_id = typeof o.variant_id === "string" ? o.variant_id : undefined;
  const product_slug = typeof o.product_slug === "string" ? o.product_slug : undefined;
  return {
    id,
    name,
    quantity: Math.max(0, Math.floor(quantity)),
    price,
    image,
    sku: normalizeLineSku(sku) || undefined,
    variant_id,
    product_slug,
  };
}

function migrateLegacyArray(parsed: unknown): StorefrontCartLine[] {
  if (!Array.isArray(parsed)) return [];
  const out: StorefrontCartLine[] = [];
  for (const el of parsed) {
    const line = normalizeItem(el);
    if (line && line.quantity > 0) {
      out.push(line);
    }
  }
  return out;
}

/**
 * Read cart from localStorage: supports versioned payload and legacy flat JSON array.
 */
export function readCartFromLocalStorage(): StorefrontCartLine[] {
  const raw = localStorage.getItem(CART_LOCAL_STORAGE_KEY);
  if (raw == null || raw === "") {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    warn("invalid JSON; starting empty cart");
    return [];
  }

  if (Array.isArray(parsed)) {
    return migrateLegacyArray(parsed);
  }

  if (!parsed || typeof parsed !== "object") {
    warn("unknown payload shape; starting empty cart");
    return [];
  }

  const o = parsed as Record<string, unknown>;
  const v = o.v;
  if (v !== CART_STORAGE_VERSION) {
    warn(`unknown version ${String(v)}; starting empty cart`);
    return [];
  }

  const items = o.items;
  if (!Array.isArray(items)) {
    warn("missing items array; starting empty cart");
    return [];
  }

  return migrateLegacyArray(items);
}

export function writeCartToLocalStorage(items: StorefrontCartLine[]): void {
  const payload: VersionedCartPayload = {
    v: CART_STORAGE_VERSION,
    items,
  };
  localStorage.setItem(CART_LOCAL_STORAGE_KEY, JSON.stringify(payload));
}
