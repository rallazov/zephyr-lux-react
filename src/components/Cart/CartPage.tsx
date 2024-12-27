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
    <div className="relative">
      <header className="fixed top-0 w-full z-10 bg-white shadow">
        {/* Header content */}
      </header>

      <main className="pt-32 max-w-6xl mx-auto p-4">
        <h1 className="text-4xl font-bold mb-6 text-center">Your Cart</h1>
        {cartItems.length === 0 ? (
          <p className="text-center text-gray-500">Your cart is empty.</p>
        ) : (
          <div>
            {/* Free Shipping Progress */}
            <div className="mb-4 bg-gray-100 p-3 rounded shadow">
              <p className="text-center text-sm font-bold text-black">{progressMessage}</p>
              <div className="relative h-2 bg-gray-300 rounded mt-2">
                <div
                  className="absolute top-0 left-0 h-full bg-green-500 rounded"
                  style={{ width: `${Math.min((total / 50) * 100, 100)}%` }}
                ></div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full table-auto border-collapse">
                <thead>
                  <tr className="bg-gray-200 text-gray-800 uppercase text-sm">
                    <th className="py-3 px-6 text-left">Product</th>
                    <th className="py-3 px-6 text-center text-black">Price</th>
                    <th className="py-3 px-6 text-center text-black">Quantity</th>
                    <th className="py-3 px-6 text-center text-black">Total</th>
                    <th className="py-3 px-6 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {cartItems.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-gray-100">
                      <td className="py-4 px-6">
                        <img
                          src={item.image || "/assets/img/Listing.jpeg"}
                          alt={item.name}
                          className="w-12 h-12 object-contain border border-gray-300 rounded"
                        />
                        <p className="font-medium mt-2 text-sm">{item.name}</p>
                        <p className="text-sm text-gray-500">Estimated delivery: 3-5 days</p>
                      </td>
                      <td className="py-4 px-6 text-center text-black">
                        ${item.price.toFixed(2)}
                      </td>
                      <td className="py-4 px-6 text-center text-black font-bold">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              removeFromCart(item.id);
                            }}
                            className="bg-gray-300 text-gray-800 px-2 py-1 rounded hover:bg-gray-400"
                          >
                            -
                          </button>
                          <span className="font-semibold">{item.quantity}</span>
                          <button
                            onClick={() => handleAddToCart(item)}
                            className="bg-gray-300 text-gray-800 px-2 py-1 rounded hover:bg-gray-400"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center text-black font-bold">
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
              <div className="mt-6 bg-gray-100 p-4 rounded shadow">
                <p className="text-lg font-semibold text-black">Subtotal: ${total.toFixed(2)}</p>
                <p className="text-sm text-gray-500">Shipping and taxes calculated at checkout.</p>
              </div>

              {/* Coupon Code Section */}
              <div className="mt-6 flex justify-between items-center bg-gray-100 p-4 rounded shadow">
                <input
                  type="text"
                  placeholder="Enter coupon code"
                  className="w-2/3 p-2 border border-gray-300 rounded"
                />
                <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                  Apply Coupon
                </button>
              </div>

              {/* Call to Action */}
              <div className="mt-6 flex justify-between">
                <button onClick = {()=> navigate("/products")} className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300">
                  Continue Shopping
                </button>
                <button onClick={()=> navigate("/checkout")} className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600">
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
