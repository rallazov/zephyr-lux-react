import {
    PaymentElement,
    useElements,
    useStripe
} from "@stripe/react-stripe-js";
import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CartContext } from "../../context/CartContext.js";

// Load Stripe outside of the component


const CheckoutPage: React.FC = () => {
    const { cartItems, clearCart } = useContext(CartContext);
    const navigate = useNavigate();
    const stripe = useStripe();
    const elements = useElements();

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        address: "",
    });

    const [errors, setErrors] = useState({
        name: "",
        email: "",
        address: "",
    });

    const [total, setTotal] = useState(0);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [orderConfirmation, setOrderConfirmation] = useState(false);
    const [formValid, setFormValid] = useState(false);


    useEffect(() => {
        calculateTotal();
    }, [cartItems]);

    useEffect(() => {
        setFormValid(validateForm());
    }, [formData, errors])

    const calculateTotal = () => {
        const subtotal = cartItems.reduce((x, y) => x + y.price * y.quantity, 0);
        setTotal(subtotal);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        setErrors({ ...errors, [name]: "" }) // Clear existing error messages when input changes
    };

    const validateForm = () => {
        let newErrors = { ...errors };
        let valid = true;

        if (!formData.name) {
            newErrors.name = "Name is required";
            valid = false;
        } else {
            newErrors.name = "";
        }

        if (!formData.email) {
            newErrors.email = "Email is required";
            valid = false;
        } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i.test(formData.email)) {
            newErrors.email = "Invalid email address";
            valid = false;
        } else {
            newErrors.email = "";
        }

        if (!formData.address) {
            newErrors.address = "Address is required";
            valid = false;
        } else {
            newErrors.address = "";
        }

        setErrors(newErrors);
        return valid;
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setProcessing(true);
        setPaymentError(null);

        if (!stripe || !elements) {
            return;
        }

        const result = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: `${window.location.origin}/order-confirmation`,
            },
        });

        setProcessing(false);

        if (result.error) {
            setPaymentError(result.error.message ?? null);
            return;
        }

        if ("paymentIntent" in result) {
            console.log("Payment Successful", result.paymentIntent);
            clearCart(); // Call clearCart to clear the cart here
            navigate("/order-confirmation");
        }
    };


    const handleConfirmationNavigation = () => {
        navigate("/order-confirmation");
        setOrderConfirmation(false);
    }

    return (

        <div className="relative bg-black text-white min-h-screen">
            <header className="fixed top-0 w-full z-10 bg-black text-white shadow">
                <div className="max-w-6xl mx-auto p-4 flex justify-between items-center">
                    <h1 className="text-xl font-bold">Zephyr Lux</h1>
                </div>
            </header>

            <main className="pt-24 max-w-4xl mx-auto p-6">
                <div className="w-full lg:w-2/3 lg:mx-auto">
                    <h1 className="text-3xl font-extrabold mb-6">Checkout</h1>

                    {/* Order Summary Section */}
                    <div className="bg-gray-800 p-4 rounded mb-6">
                        <h2 className="text-xl font-bold mb-4">Order Summary</h2>
                        {cartItems.map((item) => (
                            <div key={item.id} className="flex justify-between items-center mb-2">
                                <span className="text-gray-400">{item.name} x {item.quantity}</span>
                                <span className="text-gray-400">${(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                        ))}
                        <hr className="border-gray-700 my-2" />
                        <p className="text-gray-400">Subtotal: ${total.toFixed(2)}</p>
                        <p className="text-gray-400">Shipping (Estimate): $5.00</p>
                        <p className="text-gray-400">Taxes (Estimate): ${(total * 0.07).toFixed(2)}</p>
                        <p className="font-bold text-lg mt-2">Total: ${(total + (total * 0.07) + 5).toFixed(2)}</p>
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
                                    className={`w-full p-2 rounded bg-gray-900 text-white border ${errors.name ? "border-red-500" : "border-gray-600"}`}
                                    placeholder="Enter your name"
                                />
                                {errors.name && <p className="text-red-500 mt-1">{errors.name}</p>}
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
                                    className={`w-full p-2 rounded bg-gray-900 text-white border ${errors.email ? "border-red-500" : "border-gray-600"}`}
                                    placeholder="Enter your email"
                                />
                                {errors.email && <p className="text-red-500 mt-1">{errors.email}</p>}
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
                                    className={`w-full p-2 rounded bg-gray-900 text-white border ${errors.address ? "border-red-500" : "border-gray-600"}`}
                                    placeholder="Enter your address"
                                />
                                {errors.address && <p className="text-red-500 mt-1">{errors.address}</p>}
                            </div>
                        </form>
                    </div>

                    {/* Place Order Button */}
                    <button
                        onClick={() => {
                            if (!formValid) return;
                            setShowPaymentModal(true);
                        }}
                        className={`w-full bg-green-500 text-white p-3 rounded hover:bg-green-600 font-bold text-lg ${!formValid ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={!formValid}
                    >
                        {processing ? "Processing..." : "Place Order"}
                    </button>
                </div>
                {showPaymentModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
                        <div className="bg-gray-800 p-8 rounded w-96">
                            <h2 className="text-xl font-bold mb-4">Payment Details</h2>
                            <form onSubmit={handleSubmit}>
                                <PaymentElement />
                                {paymentError && <p className="text-red-500 mt-2">{paymentError}</p>}
                                <button
                                    type="submit"
                                    disabled={processing || !stripe || !elements}
                                    className="mt-4 bg-green-500 text-white font-bold py-2 px-4 rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {processing ? "Processing..." : "Pay Now"}
                                </button>
                            </form>
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="mt-4 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
                {orderConfirmation && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
                        <div className="bg-gray-800 p-8 rounded w-96">
                            <h2 className="text-xl font-bold mb-4">Order Confirmed!</h2>
                            <p className="mb-4">Thank you for your purchase. Your order has been successfully processed!</p>
                            <button
                                onClick={handleConfirmationNavigation}
                                className="mt-4 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
                            >
                                Go to Order Confirmation
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>

    );
};

export default CheckoutPage;