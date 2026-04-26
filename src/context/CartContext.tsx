import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { StorefrontCartLine } from "../cart/cartLine";
import {
  reconcileCartLines,
  storefrontCartLinesEqual,
} from "../cart/reconcile";
import {
  readCartFromLocalStorage,
  writeCartToLocalStorage,
} from "../cart/storage";
import type { CatalogListItem } from "../catalog/types";
import { getDefaultCatalogAdapter } from "../catalog/factory";
import { sameCartLine, normalizeLineSku } from "../cart/lineKey";

/** @alias StorefrontCartLine — persisted storefront cart row */
export type CartItem = StorefrontCartLine;

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: CartItem) => void;
  /**
   * Decrement or remove a line. Pass `sku` to target a specific variant; omit or ""
   * for legacy lines without a SKU.
   */
  removeFromCart: (id: number, sku?: string) => void;
  cartCount: number;
  clearCart: () => void;
  /** Shown after catalog sync updates prices */
  reconcileNotice: string | null;
  clearReconcileNotice: () => void;
  /** Apply catalog price/SKU sync (e.g. cart mount or after cart edits on /cart). */
  hydrateCartFromCatalog: (list: CatalogListItem[]) => void;
}

export const CartContext = createContext<CartContextType>({
  cartItems: [],
  addToCart: () => {},
  removeFromCart: () => {},
  cartCount: 0,
  clearCart: () => {},
  reconcileNotice: null,
  clearReconcileNotice: () => {},
  hydrateCartFromCatalog: () => {},
});

export const CartProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [cartItems, setCartItems] = useState<CartItem[]>(() =>
    typeof window === "undefined" ? [] : readCartFromLocalStorage()
  );
  const [reconcileNotice, setReconcileNotice] = useState<string | null>(null);

  useEffect(() => {
    writeCartToLocalStorage(cartItems);
  }, [cartItems]);

  const hydrateCartFromCatalog = useCallback((list: CatalogListItem[]) => {
    setCartItems((prev) => {
      const { lines, priceUpdated } = reconcileCartLines(prev, list);
      if (storefrontCartLinesEqual(prev, lines)) {
        return prev;
      }
      if (priceUpdated) {
        queueMicrotask(() => {
          setReconcileNotice("Prices were updated to match our current catalog.");
        });
      }
      return lines;
    });
  }, []);

  /** Initial catalog sync on app load */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const adapter = getDefaultCatalogAdapter();
        const list = await adapter.listProducts();
        if (cancelled) return;
        hydrateCartFromCatalog(list);
      } catch (e) {
        console.warn("[cart] catalog sync failed:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrateCartFromCatalog]);

  const addToCart = (product: CartItem) => {
    setCartItems((prevCartItems) => {
      const existingItem = prevCartItems.find((item) =>
        sameCartLine(item, product)
      );
      if (existingItem) {
        return prevCartItems.map((item) =>
          sameCartLine(item, product)
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      const sku = normalizeLineSku(product.sku);
      return [
        ...prevCartItems,
        {
          ...product,
          quantity: 1,
          sku: sku || undefined,
          product_slug: product.product_slug?.trim() || undefined,
        },
      ];
    });
  };

  const removeFromCart = (id: number, sku?: string) => {
    const n = normalizeLineSku(sku);
    setCartItems((prevCartItems) => {
      return prevCartItems
        .map((item) => {
          if (item.id === id && normalizeLineSku(item.sku) === n) {
            return { ...item, quantity: item.quantity - 1 };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);
    });
  };

  const clearCart = () => {
    setCartItems([]);
    setReconcileNotice(null);
  };

  const clearReconcileNotice = () => setReconcileNotice(null);

  const cartCount = useMemo(
    () => cartItems.reduce((count, item) => count + item.quantity, 0),
    [cartItems]
  );

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        cartCount,
        clearCart,
        reconcileNotice,
        clearReconcileNotice,
        hydrateCartFromCatalog,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
