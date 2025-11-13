import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

interface CartItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
  image: string;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: CartItem) => void;
  removeFromCart: (id: number) => void;
  cartCount: number;
  clearCart: () => void; // Added clearCart here
}

export const CartContext = createContext<CartContextType>({
  cartItems: [],
  addToCart: () => { },
  removeFromCart: () => { },
  cartCount: 0,
  clearCart: () => { }, // added clearCart here
});

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    const savedCart = localStorage.getItem("cartItems");
    return savedCart ? JSON.parse(savedCart) : [];
  });

  // Save cart items to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("cartItems", JSON.stringify(cartItems));
  }, [cartItems]);

  const addToCart = (product: CartItem) => {
    setCartItems((prevCartItems) => {
      const existingItem = prevCartItems.find((item) => item.id === product.id);
      if (existingItem) {
        return prevCartItems.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prevCartItems, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: number) => {
    setCartItems((prevCartItems) => {
      return prevCartItems
        .map((item) =>
          item.id === id ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0); // Remove items with quantity 0
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
    <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, cartCount, clearCart }}>
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