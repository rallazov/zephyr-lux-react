import React, {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { sameCartLine, normalizeLineSku } from "../cart/lineKey";

export interface CartItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
  image: string;
  /** Variant SKU; legacy rows may omit (merged as ""). */
  sku?: string;
}

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
}

export const CartContext = createContext<CartContextType>({
  cartItems: [],
  addToCart: () => {},
  removeFromCart: () => {},
  cartCount: 0,
  clearCart: () => {},
});

export const CartProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    const savedCart = localStorage.getItem("cartItems");
    return savedCart ? JSON.parse(savedCart) : [];
  });

  useEffect(() => {
    localStorage.setItem("cartItems", JSON.stringify(cartItems));
  }, [cartItems]);

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
      return [
        ...prevCartItems,
        { ...product, quantity: 1, sku: normalizeLineSku(product.sku) || undefined },
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
  };

  const cartCount = useMemo(
    () => cartItems.reduce((count, item) => count + item.quantity, 0),
    [cartItems]
  );

  return (
    <CartContext.Provider
      value={{ cartItems, addToCart, removeFromCart, cartCount, clearCart }}
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
