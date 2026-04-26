import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CartContext } from "../../context/CartContext";
import { checkoutSchema } from "../../lib/validation";
import { IS_MOCK_PAYMENT } from "../../utils/config";
const InnerCheckoutForm = ({ clientSecret, total, cartItems, clearCart, formValid }) => {
    const navigate = useNavigate();
    const stripe = useStripe();
    const elements = useElements();
    const [paymentError, setPaymentError] = useState(null);
    const [processing, setProcessing] = useState(false);
    const handlePaymentResult = (paymentIntentResult) => {
        if (paymentIntentResult.error) {
            setPaymentError(paymentIntentResult.error.message);
            return;
        }
        if (paymentIntentResult.paymentIntent) {
            clearCart();
            navigate("/order-confirmation", {
                state: {
                    orderId: paymentIntentResult.paymentIntent.id ?? "unknown",
                    total: total ?? 0,
                    items: cartItems.length ? cartItems : [],
                },
            });
        }
    };
    const onSubmit = async (event) => {
        event.preventDefault();
        setProcessing(true);
        setPaymentError(null);
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
                const paymentIntentResult = realResult;
                setPaymentError(paymentIntentResult.error.message);
                setProcessing(false);
                return;
            }
            else {
                const paymentIntentResult = realResult;
                handlePaymentResult(paymentIntentResult);
                setProcessing(false);
            }
        }
        catch (error) {
            setPaymentError("An unexpected error occurred during payment.");
            setProcessing(false);
        }
    };
    return (_jsxs("form", { onSubmit: onSubmit, children: [_jsx(PaymentElement, {}), paymentError && _jsx("p", { className: "text-red-500 mt-2", children: paymentError }), _jsx("button", { type: "submit", disabled: !formValid || processing, className: `w-full p-3 rounded font-bold text-lg ${processing ? "bg-gray-600" : "bg-green-500 hover:bg-green-600"}`, children: processing ? "Processing..." : "Pay Now" })] }));
};
const CheckoutPage = () => {
    const { cartItems, clearCart } = useContext(CartContext);
    const navigate = useNavigate();
    const [clientSecret, setClientSecret] = useState(null);
    const stripePromise = import.meta.env?.VITE_STRIPE_PUBLIC_KEY ? loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY) : null;
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
    const [paymentError, setPaymentError] = useState(null);
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
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        setErrors({ ...errors, [name]: "" });
        validateForm();
    };
    // If you want a separate mock flow, define it here.
    const mockStripe = {
        confirmPayment: async () => {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    if (Math.random() > 0.3) {
                        resolve({
                            paymentIntent: {
                                id: "pi_mock_123",
                                status: "succeeded",
                            },
                        });
                    }
                    else {
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
    useEffect(() => {
        if (IS_MOCK_PAYMENT)
            return;
        // fetch clientSecret from API using a fallback amount
        const fetchClientSecret = async () => {
            try {
                const tax = total * 0.07;
                const shipping = 5;
                const grandTotal = total + tax + shipping;
                const res = await fetch("/api/create-payment-intent", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ amount: Math.round(grandTotal * 100), currency: "usd" })
                });
                const json = await res.json();
                if (json?.clientSecret)
                    setClientSecret(json.clientSecret);
                else
                    setPaymentError("Failed to create payment intent");
            }
            catch (e) {
                setPaymentError("Failed to initialize payment");
            }
        };
        fetchClientSecret();
    }, [total]);
    const handleSubmit = async (event) => {
        event.preventDefault();
        setProcessing(true);
        setPaymentError(null);
        console.log("[handleSubmit] Checking IS_MOCK_PAYMENT:", IS_MOCK_PAYMENT);
        const parsed = checkoutSchema.safeParse(formData);
        if (!parsed.success) {
            const fieldErrors = {};
            parsed.error.issues.forEach((i) => { fieldErrors[i.path[0]] = i.message; });
            setErrors({ ...errors, ...fieldErrors });
            setProcessing(false);
            return;
        }
        if (IS_MOCK_PAYMENT) {
            console.log("Using mockStripe for confirmPayment.");
            try {
                const mockResult = await mockStripe.confirmPayment();
                handlePaymentResult(mockResult);
            }
            catch (error) {
                console.error("Mock Payment Error:", error);
                setPaymentError("Mock payment failed. Please try again.");
            }
            setProcessing(false);
            return;
        }
        // Real Flow
        // This submit path only used in mock mode now.
    };
    function handlePaymentResult(paymentIntentResult) {
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
    return (_jsxs("div", { className: "relative bg-black text-white min-h-screen", children: [_jsx("header", { className: "fixed top-0 w-full z-10 bg-black text-white shadow", children: _jsx("div", { className: "max-w-6xl mx-auto p-4 flex justify-between items-center", children: _jsx("h1", { className: "text-xl font-bold", children: "Zephyr Lux" }) }) }), _jsx("div", { className: "h-56" }), _jsxs("main", { className: "max-w-4xl mx-auto p-6", children: [_jsx("h1", { className: "text-3xl font-extrabold mb-6", children: "Checkout" }), _jsxs("div", { className: "bg-gray-800 p-4 rounded mb-6", children: [_jsx("h2", { className: "text-xl font-bold mb-4", children: "Order Summary" }), cartItems.map((item) => (_jsxs("div", { className: "flex justify-between items-center mb-2", children: [_jsxs("span", { className: "text-gray-400", children: [item.name, " x ", item.quantity] }), _jsxs("span", { className: "text-gray-400", children: ["$", (item.price * item.quantity).toFixed(2)] })] }, item.id))), _jsx("hr", { className: "border-gray-700 my-2" }), _jsxs("p", { className: "text-gray-400", children: ["Subtotal: $", total.toFixed(2)] }), _jsx("p", { className: "text-gray-400", children: "Shipping (Estimate): $5.00" }), _jsxs("p", { className: "text-gray-400", children: ["Taxes (Estimate): $", (total * 0.07).toFixed(2)] }), _jsxs("p", { className: "font-bold text-lg mt-2", children: ["Total: $", (total + (total * 0.07) + 5).toFixed(2)] })] }), IS_MOCK_PAYMENT ? (_jsxs("form", { onSubmit: handleSubmit, children: [paymentError && _jsx("p", { className: "text-red-500 mt-2", children: paymentError }), _jsx("button", { type: "submit", disabled: !formValid || processing, className: `w-full p-3 rounded font-bold text-lg ${processing ? "bg-gray-600" : "bg-green-500 hover:bg-green-600"}`, children: processing ? "Processing..." : "Pay Now" })] })) : (clientSecret && stripePromise ? (_jsx(Elements, { stripe: stripePromise, options: { clientSecret }, children: _jsx(InnerCheckoutForm, { clientSecret: clientSecret, total: total, cartItems: cartItems, clearCart: clearCart, formValid: formValid }) })) : (_jsx("p", { className: "text-gray-400", children: "Initializing payment..." })))] })] }));
};
export default CheckoutPage;
