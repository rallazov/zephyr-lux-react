import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
export const CartContext = createContext({
    cartItems: [],
    addToCart: () => { },
    removeFromCart: () => { },
    cartCount: 0,
    clearCart: () => { }, // added clearCart here
});
export const CartProvider = ({ children }) => {
    const [cartItems, setCartItems] = useState(() => {
        const savedCart = localStorage.getItem("cartItems");
        return savedCart ? JSON.parse(savedCart) : [];
    });
    // Save cart items to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem("cartItems", JSON.stringify(cartItems));
    }, [cartItems]);
    const addToCart = (product) => {
        setCartItems((prevCartItems) => {
            const existingItem = prevCartItems.find((item) => item.id === product.id);
            if (existingItem) {
                return prevCartItems.map((item) => item.id === product.id
                    ? { ...item, quantity: item.quantity + 1 }
                    : item);
            }
            return [...prevCartItems, { ...product, quantity: 1 }];
        });
    };
    const removeFromCart = (id) => {
        setCartItems((prevCartItems) => {
            return prevCartItems
                .map((item) => item.id === id ? { ...item, quantity: item.quantity - 1 } : item)
                .filter((item) => item.quantity > 0); // Remove items with quantity 0
        });
    };
    const clearCart = () => {
        setCartItems([]);
    };
    const cartCount = useMemo(() => cartItems.reduce((count, item) => count + item.quantity, 0), [cartItems]);
    return (_jsx(CartContext.Provider, { value: { cartItems, addToCart, removeFromCart, cartCount, clearCart }, children: children }));
};
export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error("useCart must be used within a CartProvider");
    }
    return context;
};
