import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CartContext } from "../../context/CartContext.js";

const CheckoutPage: React.FC = () => {
    const navigate = useNavigate();
    const { cartItems } = useContext(CartContext);

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        address: "",
    });

    const [total, setTotal] = useState(0);

    useEffect(() => {
        calculateTotal();
    }, [cartItems]);

    const calculateTotal = () => {
        const subtotal = cartItems.reduce((x, y) => x + y.price * y.quantity, 0);
        setTotal(subtotal);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handlePlaceOrder = () => {
        console.log("Order placed", formData);
        navigate("/order-confirmation");
    };

    return (
        <div className="relative bg-black text-white min-h-screen">
            <header className="fixed top-0 w-full z-10 bg-black text-white shadow">
                <div className="max-w-6xl mx-auto p-4 flex justify-between items-center">
                    <h1 className="text-xl font-bold">Zephyr Lux</h1>
                    <button onClick={() => navigate("/")} className="text-gray-400 hover:text-white">
                        Continue Shopping
                    </button>
                </div>
            </header>

            <main className="pt-24 max-w-4xl mx-auto p-6">
                <h1 className="text-3xl font-extrabold mb-6">Checkout</h1>

                {/* Order Summary Section */}
                <div className="bg-gray-800 p-4 rounded mb-6">
                    <h2 className="text-xl font-bold mb-4">Order Summary</h2>
                    <p className="text-gray-400">Subtotal: ${total.toFixed(2)}</p>
                    <p className="text-gray-400">Shipping: Calculated at checkout</p>
                    <p className="text-gray-400">Taxes: Calculated at checkout</p>
                    <p className="font-bold text-lg mt-2">Total: ${total.toFixed(2)}</p>
                </div>

                {/* Customer Information Form */}
                <div className="bg-gray-800 p-4 rounded mb-6">
                    <h2 className="text-xl font-bold mb-4">Customer Information</h2>
                    <form>
                        <div className="mb-4">
                            <label className="block text-gray-400 mb-1" htmlFor="name">
                                Name
                            </label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                className="w-full p-2 rounded bg-gray-900 text-white border border-gray-600"
                                placeholder="Enter your name"
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-gray-400 mb-1" htmlFor="email">
                                Email
                            </label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                className="w-full p-2 rounded bg-gray-900 text-white border border-gray-600"
                                placeholder="Enter your email"
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-gray-400 mb-1" htmlFor="address">
                                Address
                            </label>
                            <input
                                type="text"
                                id="address"
                                name="address"
                                value={formData.address}
                                onChange={handleInputChange}
                                className="w-full p-2 rounded bg-gray-900 text-white border border-gray-600"
                                placeholder="Enter your address"
                            />
                        </div>
                    </form>
                </div>

                {/* Payment Options Placeholder */}
                <div className="bg-gray-800 p-4 rounded mb-6">
                    <h2 className="text-xl font-bold mb-4">Payment</h2>
                    <p className="text-gray-400">Stripe integration coming soon...</p>
                </div>

                {/* Place Order Button */}
                <button
                    onClick={handlePlaceOrder}
                    className="w-full bg-green-500 text-white p-3 rounded hover:bg-green-600 font-bold text-lg"
                >
                    Place Order
                </button>
            </main>
        </div>
    );
};

export default CheckoutPage;
