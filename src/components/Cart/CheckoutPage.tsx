import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CartContext } from "../../context/CartContext";
import { IS_MOCK_PAYMENT } from "../../utils/config";

interface PaymentIntentResult {
    paymentIntent?: {
        id: string;
        status: string;
    };
    error?: { message: string };
}

const CheckoutPage = () => {
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
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [orderConfirmation, setOrderConfirmation] = useState(false);
    const [formValid, setFormValid] = useState(false);

    useEffect(() => {
        calculateTotal();
    }, [cartItems]);

    useEffect(() => {
        validateForm();
    }, [formData]);

    const calculateTotal = () => {
        const subtotal = cartItems.reduce((x, y) => x + y.price * y.quantity, 0);
        setTotal(subtotal);
    };

    const validateForm = () => {
        const isValid = formData.name !== "" && formData.email !== "" && formData.address !== "";
        setFormValid(isValid);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        setErrors({ ...errors, [name]: "" });
        validateForm();
    };

    // If you want a separate mock flow, define it here.
    const mockStripe = {
        confirmPayment: async (): Promise<PaymentIntentResult> => {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    if (Math.random() > 0.3) {
                        resolve({
                            paymentIntent: {
                                id: "pi_mock_123",
                                status: "succeeded",
                            },
                        });
                    } else {
                        reject({
                            error: {
                                message: "Mock payment failed (simulated).",
                            },
                        });
                    }
                }, 1000);
            });
        },
    };

    // We'll create 'realElements' if not mocking.
    console.log("IS_MOCK_PAYMENT:", IS_MOCK_PAYMENT);
    const clientSecret = ""; // TODO: fetch from backend
    console.log("Stripe object:", stripe);
    console.log("cartItems:", cartItems);
    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setProcessing(true);
        setPaymentError(null);

        console.log("[handleSubmit] Checking IS_MOCK_PAYMENT:", IS_MOCK_PAYMENT);
        if (IS_MOCK_PAYMENT) {
            console.log("Using mockStripe for confirmPayment.");
            try {
                const mockResult: PaymentIntentResult = await mockStripe.confirmPayment();
                handlePaymentResult(mockResult);
            } catch (error) {
                console.error("Mock Payment Error:", error);
                setPaymentError("Mock payment failed. Please try again.");
            }
            setProcessing(false);
            return;
        }

        // Real Flow
        console.log("[handleSubmit] elements:", elements);
        if (!stripe || !elements) {
            setPaymentError("Stripe is not initialized or missing clientSecret.");
            setProcessing(false);
            return;
        }

        try {
            const realResult = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: `${window.location.origin}/order-confirmation`,
                },
            });

            if ("error" in realResult) {
                const paymentIntentResult = realResult as { error: { message: string } };
                setPaymentError(paymentIntentResult.error.message);
                setProcessing(false);
                return;
            } else {
                const paymentIntentResult = realResult as PaymentIntentResult;
                handlePaymentResult(paymentIntentResult);
                setProcessing(false);
            }
        } catch (error) {
            console.log("Using real Stripe for confirmPayment.");
            console.error("Real Stripe Payment Error:", error);
            setPaymentError("An unexpected error occurred during payment.");
            setProcessing(false);
        }
    };

    function handlePaymentResult(paymentIntentResult: PaymentIntentResult) {
        if (paymentIntentResult.error) {
            setPaymentError(paymentIntentResult.error.message);
            return;
        }

        if (paymentIntentResult.paymentIntent) {
            console.log("Payment Successful", paymentIntentResult.paymentIntent);
            clearCart();
            setOrderConfirmation(true);
            navigate("/order-confirmation", {
                state: {
                    orderId: paymentIntentResult.paymentIntent.id ?? "unknown",
                    total: total ?? 0,
                    items: cartItems.length ? cartItems : [],
                },
            });
        }
    }

    return (
        <div className="relative bg-black text-white min-h-screen">
            <header className="fixed top-0 w-full z-10 bg-black text-white shadow">
                <div className="max-w-6xl mx-auto p-4 flex justify-between items-center">
                    <h1 className="text-xl font-bold">Zephyr Lux</h1>
                </div>
            </header>

            <div className="h-56"></div>

            <main className="max-w-4xl mx-auto p-6">
                <h1 className="text-3xl font-extrabold mb-6">Checkout</h1>
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

                <form onSubmit={handleSubmit}>
                    {/* Only show PaymentElement if not mock and we have realElements. */}
                    {!IS_MOCK_PAYMENT && realElements && <PaymentElement />}

                    {paymentError && <p className="text-red-500 mt-2">{paymentError}</p>}

                    <button
                        type="submit"
                        disabled={!formValid || processing}
                        className={`w-full p-3 rounded font-bold text-lg ${processing ? "bg-gray-600" : "bg-green-500 hover:bg-green-600"}`}
                    >
                        {processing ? "Processing..." : "Pay Now"}
                    </button>
                </form>
            </main>
        </div>
    );
};

export default CheckoutPage;
