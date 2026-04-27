import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  isCartOkForCheckout,
  validateStorefrontCartLines,
} from "../../cart/reconcile";
import { CartContext } from "../../context/CartContext";
import { getDefaultCatalogAdapter } from "../../catalog/factory";
import type { CatalogListItem } from "../../catalog/types";
import { useCartQuote } from "../../hooks/useCartQuote";
import { checkoutSchema } from "../../lib/validation";
import { IS_MOCK_PAYMENT } from "../../utils/config";

interface PaymentIntentResult {
    paymentIntent?: {
        id: string;
        status: string;
    };
    error?: { message: string };
}

const InnerCheckoutForm: React.FC<{
    orderTotalDollars: number;
    cartItems: unknown[];
    clearCart: () => void;
    formValid: boolean;
    readyToPay: boolean;
    customerEmail: string;
}> = ({ orderTotalDollars, cartItems, clearCart, formValid, readyToPay, customerEmail }) => {
    const navigate = useNavigate();
    const stripe = useStripe();
    const elements = useElements();
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    const handlePaymentResult = (paymentIntentResult: PaymentIntentResult) => {
        if (paymentIntentResult.error) {
            setPaymentError(paymentIntentResult.error.message);
            return;
        }
        if (paymentIntentResult.paymentIntent) {
            const { id, status } = paymentIntentResult.paymentIntent;
            if (status !== "succeeded") {
                setPaymentError(
                    status === "processing"
                        ? "Payment is still processing. You can check your email for updates or wait and refresh."
                        : status
                          ? `Payment not completed (status: ${status}). You can try again.`
                          : "Could not confirm payment status. Check your email or try again."
                );
                return;
            }
            clearCart();
            navigate("/order-confirmation", {
                state: {
                    orderId: id ?? "unknown",
                    total: orderTotalDollars ?? 0,
                    items: cartItems.length ? cartItems : [],
                    email: customerEmail || undefined,
                },
            });
        }
    };

    const onSubmit = async (event: React.FormEvent) => {
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
                const paymentIntentResult = realResult as { error: { message: string } };
                setPaymentError(paymentIntentResult.error.message);
                setProcessing(false);
                return;
            } else {
                const paymentIntentResult = realResult as PaymentIntentResult;
                handlePaymentResult(paymentIntentResult);
                setProcessing(false);
            }
        } catch {
            setPaymentError("An unexpected error occurred during payment.");
            setProcessing(false);
        }
    };

    return (
        <form onSubmit={onSubmit}>
            <PaymentElement />
            {paymentError && (
                <p className="text-red-500 mt-2" role="alert">
                    {paymentError}
                </p>
            )}
            <button
                type="submit"
                disabled={!formValid || !readyToPay || processing}
                className={`w-full p-3 rounded font-bold text-lg ${processing ? "bg-gray-600" : "bg-green-500 hover:bg-green-600"}`}
            >
                {processing ? "Processing..." : "Pay Now"}
            </button>
        </form>
    );
};

const CheckoutPage = () => {
    const { cartItems, clearCart } = useContext(CartContext);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const checkoutCanceled = searchParams.get("checkout") === "canceled";

    const [catalogList, setCatalogList] = useState<CatalogListItem[] | null>(null);
    const [catalogError, setCatalogError] = useState(false);

    const {
        quote,
        error: cartQuoteError,
        refetch: refetchCartQuote,
        drafts: checkoutLines,
        loading: cartQuoteLoading,
    } = useCartQuote(cartItems);

    const [clientSecret, setClientSecret] = useState<string | null>(null);

    const validations = useMemo(() => {
        if (!catalogList) return null;
        return validateStorefrontCartLines(cartItems, catalogList);
    }, [cartItems, catalogList]);

    const checkoutOk =
        catalogList != null &&
        validations != null &&
        cartItems.length > 0 &&
        isCartOkForCheckout(validations);

    const stripePromise = useMemo(() => {
        if (!checkoutOk) return null;
        const key = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
        if (!key) return null;
        return loadStripe(key);
    }, [checkoutOk]);

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        address: "",
        city: "",
        state: "",
        postal_code: "",
        country: "US",
    });

    const [debouncedCheckoutContext, setDebouncedCheckoutContext] = useState({
        email: "",
        name: "",
        address: "",
        city: "",
        state: "",
        postal_code: "",
        country: "US",
    });

    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedCheckoutContext({
                email: formData.email.trim(),
                name: formData.name.trim(),
                address: formData.address.trim(),
                city: formData.city.trim(),
                state: formData.state.trim(),
                postal_code: formData.postal_code.trim(),
                country: formData.country.trim() || "US",
            });
        }, 500);
        return () => clearTimeout(t);
    }, [
        formData.email,
        formData.name,
        formData.address,
        formData.city,
        formData.state,
        formData.postal_code,
        formData.country,
    ]);

    const contactInSync =
        formData.email.trim() === debouncedCheckoutContext.email &&
        formData.name.trim() === debouncedCheckoutContext.name &&
        formData.address.trim() === debouncedCheckoutContext.address &&
        formData.city.trim() === debouncedCheckoutContext.city &&
        formData.state.trim() === debouncedCheckoutContext.state &&
        formData.postal_code.trim() === debouncedCheckoutContext.postal_code &&
        formData.country.trim() === debouncedCheckoutContext.country;

    const paymentBootstrapKey = useMemo(
        () => JSON.stringify({ lines: checkoutLines, ...debouncedCheckoutContext }),
        [checkoutLines, debouncedCheckoutContext]
    );

    /** Stable fingerprint so catalog list fetch is not tied to cart array identity. */
    const catalogFetchKey = useMemo(
        () =>
            JSON.stringify(
                cartItems.map((i) => ({
                    id: i.id,
                    sku: i.sku ?? null,
                    quantity: i.quantity,
                }))
            ),
        [cartItems]
    );

    const [errors, setErrors] = useState({
        name: "",
        email: "",
        address: "",
        city: "",
        state: "",
        postal_code: "",
        country: "",
    });

    const [paymentError, setPaymentError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [formValid, setFormValid] = useState(false);

    useEffect(() => {
        if (cartItems.length === 0) {
            navigate("/cart", { replace: true });
        }
    }, [cartItems.length, navigate]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const list = await getDefaultCatalogAdapter().listProducts();
                if (!cancelled) {
                    setCatalogList(list);
                    setCatalogError(false);
                }
            } catch {
                if (!cancelled) setCatalogError(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [catalogFetchKey]);

    const validateForm = useCallback(() => {
        const isValid =
            formData.name !== "" &&
            formData.email !== "" &&
            formData.address !== "" &&
            formData.city !== "" &&
            formData.state !== "" &&
            formData.postal_code !== "" &&
            formData.country !== "";
        setFormValid(isValid);
    }, [
        formData.name,
        formData.email,
        formData.address,
        formData.city,
        formData.state,
        formData.postal_code,
        formData.country,
    ]);

    useEffect(() => {
        validateForm();
    }, [validateForm]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        setErrors((prev) => ({ ...prev, [name]: "" }));
    };

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

    useEffect(() => {
        if (!checkoutOk) {
            setClientSecret(null);
        }
    }, [checkoutOk]);

    useEffect(() => {
        if (IS_MOCK_PAYMENT || !checkoutOk || !quote || checkoutLines.length === 0) {
            if (!IS_MOCK_PAYMENT) {
                setClientSecret(null);
            }
            return;
        }
        let cancelled = false;
        const run = async () => {
            setClientSecret(null);
            setPaymentError(null);
            try {
                const res = await fetch("/api/create-payment-intent", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        items: checkoutLines,
                        email: debouncedCheckoutContext.email || undefined,
                        currency: "usd",
                        ...(debouncedCheckoutContext.name.length > 0 &&
                        debouncedCheckoutContext.address.length > 0 &&
                        debouncedCheckoutContext.city.length > 0 &&
                        debouncedCheckoutContext.state.length > 0 &&
                        debouncedCheckoutContext.postal_code.length > 0 &&
                        debouncedCheckoutContext.country.length > 0
                            ? {
                                  customer_name: debouncedCheckoutContext.name,
                                  shipping_address: {
                                      name: debouncedCheckoutContext.name,
                                      line1: debouncedCheckoutContext.address,
                                      city: debouncedCheckoutContext.city,
                                      state: debouncedCheckoutContext.state,
                                      postal_code: debouncedCheckoutContext.postal_code,
                                      country: debouncedCheckoutContext.country,
                                  },
                              }
                            : {}),
                    }),
                });
                const json = (await res.json()) as {
                    clientSecret?: string;
                    error?: string;
                    checkoutRef?: string;
                    orderLookupKey?: string;
                };
                if (cancelled) return;
                if (!res.ok) {
                    setClientSecret(null);
                    setPaymentError(
                        json.error ??
                            "We could not start payment for your bag. Please return to your bag and try again."
                    );
                    return;
                }
                if (json?.clientSecret) {
                    setClientSecret(json.clientSecret);
                    const cs = json.clientSecret;
                    const at = cs.indexOf("_secret_");
                    const piId = at > 0 ? cs.slice(0, at) : null;
                    if (piId && json.orderLookupKey) {
                        try {
                            sessionStorage.setItem(`zlx_pilu_${piId}`, json.orderLookupKey);
                        } catch {
                            // ignore private mode / quota
                        }
                    }
                } else {
                    setClientSecret(null);
                    setPaymentError("Failed to create payment intent");
                }
            } catch {
                if (!cancelled) {
                    setClientSecret(null);
                    setPaymentError("Failed to initialize payment");
                }
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    // paymentBootstrapKey encodes checkoutLines + debounced contact/shipping
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid duplicate fetches when primitives match fingerprint
    }, [paymentBootstrapKey, checkoutOk, quote]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!checkoutOk) return;
        setProcessing(true);
        setPaymentError(null);

        const parsed = checkoutSchema.safeParse(formData);
        if (!parsed.success) {
            const fieldErrors: Record<string, string> = {};
            parsed.error.issues.forEach((i) => { fieldErrors[i.path[0] as string] = i.message; });
            setErrors({ ...errors, ...fieldErrors });
            setProcessing(false);
            return;
        }
        if (IS_MOCK_PAYMENT) {
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
    };

    function handlePaymentResult(paymentIntentResult: PaymentIntentResult) {
        if (paymentIntentResult.error) {
            setPaymentError(paymentIntentResult.error.message);
            return;
        }

        if (paymentIntentResult.paymentIntent) {
            const { id, status } = paymentIntentResult.paymentIntent;
            if (status !== "succeeded") {
                setPaymentError(
                    status === "processing"
                        ? "Payment is still processing. Check your email for updates."
                        : status
                          ? `Payment not completed (status: ${status}). You can try again.`
                          : "Could not confirm payment status. Check your email or try again."
                );
                return;
            }
            clearCart();
            navigate("/order-confirmation", {
                state: {
                    orderId: id ?? "unknown",
                    total: quote ? quote.total_cents / 100 : 0,
                    items: cartItems.length ? cartItems : [],
                    email: formData.email || undefined,
                },
            });
        }
    }

    if (cartItems.length === 0) {
        return null;
    }

    if (catalogList === null && !catalogError) {
        return (
            <div className="relative bg-black text-white min-h-screen">
                <div className="h-56" />
                <main className="max-w-4xl mx-auto p-6">
                    <p className="text-gray-400">Verifying your bag…</p>
                </main>
            </div>
        );
    }

    if (catalogError) {
        return (
            <div className="relative bg-black text-white min-h-screen">
                <div className="h-56" />
                <main className="max-w-4xl mx-auto p-6" role="alert">
                    <h1 className="text-2xl font-bold mb-4">Checkout unavailable</h1>
                    <p className="text-gray-300 mb-4">
                        We could not verify your cart against the catalog. Return to your bag and try again.
                    </p>
                    <Link to="/cart" className="text-green-400 underline font-semibold">
                        Return to bag
                    </Link>
                </main>
            </div>
        );
    }

    if (!checkoutOk && validations) {
        return (
            <div className="relative bg-black text-white min-h-screen">
                <header className="fixed top-0 w-full z-10 bg-black text-white shadow">
                    <div className="max-w-6xl mx-auto p-4 flex justify-between items-center">
                        <h1 className="text-xl font-bold">Zephyr Lux</h1>
                    </div>
                </header>
                <div className="h-56" />
                <main className="max-w-4xl mx-auto p-6" role="alert">
                    <h1 className="text-3xl font-extrabold mb-4">Update your bag</h1>
                    <p className="text-gray-300 mb-4">
                        One or more items need attention before you can pay. Fix the issues below in your bag, then try checkout again.
                    </p>
                    <ul className="list-disc list-inside text-gray-200 space-y-2 mb-6">
                        {validations
                            .filter((v) => v.issues.length > 0)
                            .map((v) => (
                                <li key={`${v.line.id}::${v.line.sku ?? ""}`}>
                                    <span className="font-medium text-white">{v.line.name}: </span>
                                    {v.issues.map((i) => i.message).join(" ")}
                                </li>
                            ))}
                    </ul>
                    <Link
                        to="/cart"
                        className="inline-block bg-green-600 text-white px-6 py-3 rounded font-semibold hover:bg-green-500"
                    >
                        Return to bag
                    </Link>
                </main>
            </div>
        );
    }

    const orderLineDisplay = quote
        ? quote.lines.map((line) => ({
            name: line.product_title,
            quantity: line.quantity,
            lineTotal: line.line_cents / 100,
        }))
        : cartQuoteLoading
          ? []
          : cartQuoteError && validations
            ? validations.map((v) => ({
                name: v.line.name,
                quantity: v.line.quantity,
                lineTotal: (v.displayUnitPrice ?? v.line.price) * v.line.quantity,
            }))
            : validations
              ? validations.map((v) => ({
                name: v.line.name,
                quantity: v.line.quantity,
                lineTotal: (v.displayUnitPrice ?? v.line.price) * v.line.quantity,
            }))
              : cartItems.map((item) => ({
                name: item.name,
                quantity: item.quantity,
                lineTotal: item.price * item.quantity,
            }));

    return (
        <div className="relative bg-black text-white min-h-screen">
            <header className="fixed top-0 w-full z-10 bg-black text-white shadow">
                <div className="max-w-6xl mx-auto p-4 flex justify-between items-center">
                    <h1 className="text-xl font-bold">Zephyr Lux</h1>
                </div>
            </header>

            <div className="h-56" />

            <main className="max-w-4xl mx-auto p-6">
                {checkoutCanceled && (
                    <div
                        role="status"
                        className="mb-4 p-3 rounded border border-amber-600 bg-amber-950 text-amber-100 text-sm"
                    >
                        Checkout was canceled — your bag is still saved. You can
                        return to it anytime.
                    </div>
                )}
                <div className="mb-4">
                    <Link
                        to="/cart"
                        className="text-amber-300 underline text-sm"
                    >
                        ← Back to bag
                    </Link>
                </div>
                <h1 className="text-3xl font-extrabold mb-6">Checkout</h1>
                <div className="bg-gray-800 p-4 rounded mb-6">
                    <h2 className="text-xl font-bold mb-4">Order Summary</h2>
                    {cartQuoteError && (
                        <div className="text-red-400 mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2" role="alert">
                            <span>{cartQuoteError}</span>
                            <button
                                type="button"
                                onClick={refetchCartQuote}
                                className="text-amber-300 underline text-sm"
                            >
                                Retry
                            </button>
                        </div>
                    )}
                    {cartQuoteLoading && !quote && (
                        <p className="text-gray-500 text-sm mb-2" role="status">
                            Loading line items from the catalog…
                        </p>
                    )}
                    {orderLineDisplay.map((row, idx) => (
                        <div key={`${idx}-${row.name}`} className="flex justify-between items-center mb-2">
                            <span className="text-gray-400">{row.name} x {row.quantity}</span>
                            <span className="text-gray-400">${row.lineTotal.toFixed(2)}</span>
                        </div>
                    ))}
                    <hr className="border-gray-700 my-2" />
                    {quote ? (
                        <>
                            <p className="text-gray-400">
                                Subtotal: ${(quote.subtotal_cents / 100).toFixed(2)}
                            </p>
                            <p className="text-gray-400">
                                Shipping:{" "}
                                {quote.shipping_cents === 0
                                    ? "Free"
                                    : `$${(quote.shipping_cents / 100).toFixed(2)}`}
                            </p>
                            <p className="text-gray-400">
                                Tax: ${(quote.tax_cents / 100).toFixed(2)}
                            </p>
                            <p className="font-bold text-lg mt-2">
                                Total: ${(quote.total_cents / 100).toFixed(2)}
                            </p>
                        </>
                    ) : (
                        <p className="text-gray-500 text-sm" role="status">
                            {!cartQuoteError
                                ? "Calculating your totals from the current catalog…"
                                : "Fix pricing above to continue."}
                        </p>
                    )}
                </div>

                <div className="bg-gray-800 p-4 rounded mb-6">
                    <h2 className="text-lg font-bold mb-3">Contact &amp; shipping</h2>
                    <div className="space-y-3 max-w-md">
                        <div>
                            <label htmlFor="ck-name" className="block text-sm text-gray-400 mb-1">
                                Full name
                            </label>
                            <input
                                id="ck-name"
                                name="name"
                                value={formData.name}
                                onChange={handleFormChange}
                                className="w-full p-2 rounded bg-gray-900 border border-gray-600 text-white"
                                autoComplete="name"
                            />
                            {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
                        </div>
                        <div>
                            <label htmlFor="ck-email" className="block text-sm text-gray-400 mb-1">
                                Email
                            </label>
                            <input
                                id="ck-email"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleFormChange}
                                className="w-full p-2 rounded bg-gray-900 border border-gray-600 text-white"
                                autoComplete="email"
                            />
                            {errors.email && <p className="text-red-400 text-sm mt-1">{errors.email}</p>}
                        </div>
                        <div>
                            <label htmlFor="ck-addr" className="block text-sm text-gray-400 mb-1">
                                Shipping address
                            </label>
                            <textarea
                                id="ck-addr"
                                name="address"
                                value={formData.address}
                                onChange={handleFormChange}
                                rows={3}
                                className="w-full p-2 rounded bg-gray-900 border border-gray-600 text-white"
                                autoComplete="street-address"
                            />
                            {errors.address && <p className="text-red-400 text-sm mt-1">{errors.address}</p>}
                        </div>
                        <div>
                            <label htmlFor="ck-city" className="block text-sm text-gray-400 mb-1">
                                City
                            </label>
                            <input
                                id="ck-city"
                                name="city"
                                value={formData.city}
                                onChange={handleFormChange}
                                className="w-full p-2 rounded bg-gray-900 border border-gray-600 text-white"
                                autoComplete="address-level2"
                            />
                            {errors.city && <p className="text-red-400 text-sm mt-1">{errors.city}</p>}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="ck-state" className="block text-sm text-gray-400 mb-1">
                                    State / region
                                </label>
                                <input
                                    id="ck-state"
                                    name="state"
                                    value={formData.state}
                                    onChange={handleFormChange}
                                    className="w-full p-2 rounded bg-gray-900 border border-gray-600 text-white"
                                    autoComplete="address-level1"
                                />
                                {errors.state && <p className="text-red-400 text-sm mt-1">{errors.state}</p>}
                            </div>
                            <div>
                                <label htmlFor="ck-postal" className="block text-sm text-gray-400 mb-1">
                                    Postal code
                                </label>
                                <input
                                    id="ck-postal"
                                    name="postal_code"
                                    value={formData.postal_code}
                                    onChange={handleFormChange}
                                    className="w-full p-2 rounded bg-gray-900 border border-gray-600 text-white"
                                    autoComplete="postal-code"
                                />
                                {errors.postal_code && (
                                    <p className="text-red-400 text-sm mt-1">{errors.postal_code}</p>
                                )}
                            </div>
                        </div>
                        <div>
                            <label htmlFor="ck-country" className="block text-sm text-gray-400 mb-1">
                                Country
                            </label>
                            <input
                                id="ck-country"
                                name="country"
                                value={formData.country}
                                onChange={handleFormChange}
                                className="w-full p-2 rounded bg-gray-900 border border-gray-600 text-white"
                                autoComplete="country-name"
                            />
                            {errors.country && <p className="text-red-400 text-sm mt-1">{errors.country}</p>}
                        </div>
                    </div>
                </div>

                {!IS_MOCK_PAYMENT && paymentError && !clientSecret && (
                    <p className="text-red-500 mt-2 mb-4" role="alert">
                        {paymentError}
                    </p>
                )}

                {IS_MOCK_PAYMENT ? (
                    <form onSubmit={handleSubmit}>
                        {paymentError && (
                            <p className="text-red-500 mt-2" role="alert">
                                {paymentError}
                            </p>
                        )}
                        <button
                            type="submit"
                            disabled={
                                !checkoutOk ||
                                !formValid ||
                                !contactInSync ||
                                processing ||
                                !quote ||
                                Boolean(cartQuoteError)
                            }
                            className={`w-full p-3 rounded font-bold text-lg ${processing ? "bg-gray-600" : "bg-green-500 hover:bg-green-600"}`}
                        >
                            {processing ? "Processing..." : "Pay Now"}
                        </button>
                    </form>
                ) : (
                    clientSecret && stripePromise && quote ? (
                        <>
                            {!contactInSync && formValid && (
                                <p className="text-amber-200 text-sm mb-3" role="status">
                                    Syncing your details with the payment form — wait a moment, then use Pay
                                    Now.
                                </p>
                            )}
                            <Elements key={paymentBootstrapKey} stripe={stripePromise} options={{ clientSecret }}>
                            <InnerCheckoutForm
                                orderTotalDollars={quote.total_cents / 100}
                                cartItems={cartItems}
                                clearCart={clearCart}
                                formValid={formValid}
                                readyToPay={contactInSync}
                                customerEmail={formData.email}
                            />
                        </Elements>
                        </>
                    ) : (
                        <p className="text-gray-400" role="status">
                            {!quote && !cartQuoteError
                                ? "Loading pricing and payment…"
                                : "Initializing payment..."}
                        </p>
                    )
                )}
            </main>
        </div>
    );
};

export default CheckoutPage;
