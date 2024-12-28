import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CartContext } from "../../context/CartContext.js";

const CartPage: React.FC = () => {
  const { cartItems, addToCart, removeFromCart } = useContext(CartContext);
  const [progressMessage, setProgressMessage] = useState("Spend $50 more to qualify for free shipping!");
  const navigate = useNavigate();

  const total = cartItems.reduce((x, y) => x + y.price * y.quantity, 0);

  useEffect(() => {
    updateProgressMessage();
  }, [cartItems]);

  const handleAddToCart = (item: any) => {
    addToCart(item);
  };

  const updateProgressMessage = () => {
    const newTotal = cartItems.reduce((x, y) => x + y.price * y.quantity, 0);
    const remaining = 50 - newTotal;
    if (remaining <= 0) {
      setProgressMessage("Congratulations! You've qualified for free shipping!");
    } else {
      setProgressMessage(`Spend $${remaining.toFixed(2)} more to qualify for free shipping!`);
    }
  };

  return (
    <div className="relative bg-black text-white min-h-screen">
      <header className="fixed top-0 w-full z-10 bg-black text-white shadow">
        {/* Header content */}
      </header>

      <main className="pt-52 max-w-6xl mx-auto p-4">
        <div className="flex justify-center items-center space-x-4">
          <h1 className="text-4xl font-extrabold">SHOPPING</h1>
          <h1 className="text-4xl font-bold text-gray-700">BAG</h1>
        </div>
        {cartItems.length === 0 ? (
          <p className="text-center text-gray-400">Your cart is empty.</p>
        ) : (
          <div>
            {/* Free Shipping Progress */}
            <div className="mb-4 bg-black p-3 rounded shadow border border-gray-600">
              <p className="text-center text-sm font-bold text-green-400">{progressMessage}</p>
              <div className="relative h-2 bg-gray-800 rounded mt-2">
                <div
                  className="absolute top-0 left-0 h-full bg-green-500 rounded"
                  style={{ width: `${Math.min((total / 50) * 100, 100)}%` }}
                ></div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full table-auto border-collapse">
                <thead>
                  <tr className="bg-black text-white uppercase text-sm border-b border-gray-700">
                    <th className="py-3 px-6 text-left">Product</th>
                    <th className="py-3 px-6 text-center">Price</th>
                    <th className="py-3 px-6 text-center">Quantity</th>
                    <th className="py-3 px-6 text-center">Total</th>
                    <th className="py-3 px-6 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-black">
                  {cartItems.map((item) => (
                    <tr key={item.id} className="border-b border-gray-700 hover:bg-gray-800">
                      <td className="py-4 px-6 flex flex-col sm:flex-row gap-4 items-center"> {/* Key changes here */}
                        <img
                          src={item.image || "/assets/img/Listing.jpeg"}
                          alt={item.name}
                          className="w-16 h-16 object-contain border border-gray-600 rounded bg-white sm:w-20 sm:h-20"
                        />
                        <div className="text-center sm:text-left"> {/* Key changes here */}
                          <p className="font-medium text-sm text-white">{item.name}</p>
                          <p className="text-sm text-gray-400">Estimated delivery: 3-5 days</p>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center font-semibold text-white">
                        ${item.price.toFixed(2)}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex flex-col items-center justify-center md:flex-row md:gap-2">
                          <span className="font-semibold text-white md:hidden mb-1">Quantity</span>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="bg-gray-700 text-white px-2 py-1 rounded hover:bg-gray-500"
                          >
                            -
                          </button>
                          <span className="font-semibold text-white">{item.quantity}</span>
                          <button
                            onClick={() => handleAddToCart(item)}
                            className="bg-gray-700 text-white px-2 py-1 rounded hover:bg-gray-500"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center font-bold text-white">
                        ${(item.price * item.quantity).toFixed(2)}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => {
                            removeFromCart(item.id);
                          }}
                          className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Cart Summary */}
              <div className="mt-6 bg-black p-4 rounded shadow border border-gray-600">
                <p className="text-lg font-semibold text-white">Subtotal: ${total.toFixed(2)}</p>
                <p className="text-sm text-gray-400">Shipping and taxes calculated at checkout.</p>
              </div>

              {/* Coupon Code Section */}
              <div className="mt-6 flex justify-between items-center bg-black p-4 rounded shadow border border-gray-600">
                <input
                  type="text"
                  placeholder="Enter coupon code"
                  className="w-2/3 p-2 border border-gray-600 rounded bg-gray-800 text-white"
                />
                <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                  Apply Coupon
                </button>
              </div>

              {/* Call to Action */}
              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => navigate("/products")}
                  className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600"
                >
                  Continue Shopping
                </button>
                <button
                  onClick={() => navigate("/checkout")}
                  className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600"
                >
                  Proceed to Checkout
                </button>
              </div>

              {/* Trust Badges */}
              <div className="mt-6 flex justify-center gap-4">
                <img
                  src="/assets/img/secure-payment.png"
                  alt="Secure Payment"
                  className="w-16 h-16"
                />
                <img
                  src="/assets/img/free-returns.png"
                  alt="Free Returns"
                  className="w-16 h-16"
                />
                <img
                  src="/assets/img/satisfaction-guaranteed.png"
                  alt="Satisfaction Guaranteed"
                  className="w-16 h-16"
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default CartPage;