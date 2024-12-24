import React, { useContext } from "react";
import { CartContext } from "../../context/CartContext.js"; // Adjust based on your context location

const CartPage: React.FC = () => {
  const { cartItems, removeFromCart } = useContext(CartContext);

  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Your Cart</h1>
      {cartItems.length === 0 ? (
        <p className="text-gray-500">Your cart is empty.</p>
      ) : (
        <div className="space-y-4">
          {cartItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between border-b pb-4"
            >
              <img
                // src={item.image || "https://via.placeholder.com/80"}
                alt={item.name}
                className="w-20 h-auto"
              />
              <div className="flex-grow ml-4">
                <h3 className="text-xl font-semibold">{item.name}</h3>
                <p className="text-gray-600">
                  Quantity: {item.quantity} x ${item.price.toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => removeFromCart(item.id)}
                className="bg-red-500 text-white px-4 py-2 rounded"
              >
                Remove
              </button>
            </div>
          ))}
          <div className="text-right text-xl font-bold mt-4">Total: ${total.toFixed(2)}</div>
          <button className="bg-green-500 text-white px-6 py-2 rounded mt-4">
            Proceed to Checkout
          </button>
        </div>
      )}
    </div>
  );
};

export default CartPage;
