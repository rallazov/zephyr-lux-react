import React, { useContext } from "react";
import { CartContext } from "../../context/CartContext.js";

const CartPage: React.FC = () => {
  const { cartItems, addToCart, removeFromCart } = useContext(CartContext);

  const total = cartItems.reduce((x, y) => x + y.price * y.quantity, 0);

  return (
    <div className="relative">
      <header className="fixed top-0 w-full z-10 bg-white shadow">
        {/* Header content */}
      </header>

      <main className="pt-52 max-w-6xl mx-auto p-4">
        <h1 className="text-4xl font-bold mb-6 text-center text-gray-800">
          Your Cart
        </h1>
        {cartItems.length === 0 ? (
          <p className="text-center text-gray-600 text-lg">
            Your cart is empty.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700 uppercase text-sm font-semibold">
                  <th className="py-3 px-6 text-left">Product</th>
                  <th className="py-3 px-6 text-center">Price</th>
                  <th className="py-3 px-6 text-center">Quantity</th>
                  <th className="py-3 px-6 text-center">Total</th>
                  <th className="py-3 px-6 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {cartItems.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <img
                        src={"/assets/img/Listing.jpeg"}
                        alt={"Image Not Available"}
                        className="w-12 h-12 object-contain border border-gray-300 rounded"
                      />
                      <p className="font-medium text-gray-700 mt-2 text-sm">
                        {item.name}
                      </p>
                    </td>
                    <td className="py-4 px-6 text-center text-gray-600">
                      ${item.price.toFixed(2)}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="bg-gray-300 text-gray-700 px-2 py-1 rounded hover:bg-gray-400"
                        >
                          -
                        </button>
                        <span className="font-semibold text-gray-800">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => addToCart(item)}
                          className="bg-gray-300 text-gray-700 px-2 py-1 rounded hover:bg-gray-400"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center text-gray-600">
                      ${(item.price * item.quantity).toFixed(2)}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-6 text-right">
              <p className="text-xl font-semibold text-gray-800">
                Subtotal:{" "}
                <span className="text-gray-900 font-bold">
                  ${total.toFixed(2)}
                </span>
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default CartPage;
