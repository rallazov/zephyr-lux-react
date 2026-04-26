import { faCheckCircle, faLock, faUndoAlt } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { normalizeLineSku } from "../../cart/lineKey";
import {
  isCartOkForCheckout,
  validateStorefrontCartLines,
} from "../../cart/reconcile";
import type { CartLineValidation } from "../../cart/reconcile";
import { CartContext } from "../../context/CartContext";
import { getDefaultCatalogAdapter } from "../../catalog/factory";
import type { CatalogListItem } from "../../catalog/types";
import { useCartQuote } from "../../hooks/useCartQuote";
import type { CartLineQuote } from "../../lib/cartQuoteTypes";
import { formatCents } from "../../lib/money";

function lineKey(item: { id: number; sku?: string }): string {
  return `${item.id}::${normalizeLineSku(item.sku)}`;
}

function incrementDisabled(v: CartLineValidation | undefined): boolean {
  if (!v) return false;
  if (v.issues.length > 0) return true;
  if (v.maxQuantity == null) return true;
  return v.line.quantity >= v.maxQuantity;
}

const CartPage: React.FC = () => {
  const {
    cartItems,
    addToCart,
    removeFromCart,
    reconcileNotice,
    clearReconcileNotice,
    hydrateCartFromCatalog,
  } = useContext(CartContext);
  const [catalogList, setCatalogList] = useState<CatalogListItem[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState(
    "Spend $50 more to qualify for free shipping!"
  );
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const checkoutCanceled = searchParams.get("checkout") === "canceled";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getDefaultCatalogAdapter().listProducts();
        if (cancelled) return;
        setCatalogError(null);
        setCatalogList(list);
        hydrateCartFromCatalog(list);
      } catch {
        if (!cancelled) {
          setCatalogError("We couldn't refresh availability. Try again.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cartItems, hydrateCartFromCatalog]);

  const validations = useMemo(() => {
    if (!catalogList) return null;
    return validateStorefrontCartLines(cartItems, catalogList);
  }, [cartItems, catalogList]);

  const validationByKey = useMemo(() => {
    const m = new Map<string, CartLineValidation>();
    if (!validations) return m;
    for (const v of validations) {
      m.set(lineKey(v.line), v);
    }
    return m;
  }, [validations]);

  const checkoutAllowed =
    catalogList != null &&
    validations != null &&
    cartItems.length > 0 &&
    isCartOkForCheckout(validations);

  const { quote, loading: quoteLoading, error: quoteError, refetch: refetchQuote, drafts: checkoutDrafts } =
    useCartQuote(cartItems);

  const subtotal = useMemo(() => {
    if (!validations) {
      return cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
    }
    return validations.reduce((s, v) => {
      if (v.issues.length > 0) {
        return s;
      }
      const unit = v.displayUnitPrice ?? v.line.price;
      return s + unit * v.line.quantity;
    }, 0);
  }, [validations, cartItems]);

  const lineQuoteByCartIndex = useMemo(() => {
    const m = new Map<number, CartLineQuote>();
    if (!quote) return m;
    let d = 0;
    cartItems.forEach((item, idx) => {
      if (normalizeLineSku(item.sku) === "") return;
      const row = quote.lines[d];
      if (row) m.set(idx, row);
      d += 1;
    });
    return m;
  }, [quote, cartItems]);

  const progressSubtotalDollars = quote ? quote.subtotal_cents / 100 : subtotal;

  useEffect(() => {
    const remaining = 50 - progressSubtotalDollars;
    if (remaining <= 0) {
      setProgressMessage("Congratulations! You've qualified for free shipping!");
    } else {
      setProgressMessage(
        `Spend $${remaining.toFixed(2)} more to qualify for free shipping!`
      );
    }
  }, [progressSubtotalDollars]);

  return (
    <div className="relative bg-black text-white min-h-screen">
      <header className="fixed top-0 w-full z-10 bg-black text-white shadow">
        {/* Header content */}
      </header>

      <main className="pt-52 max-w-6xl mx-auto p-4">
        {checkoutCanceled && (
          <div
            role="status"
            className="mb-6 p-3 rounded border border-amber-600 bg-amber-950 text-amber-100 text-sm max-w-2xl mx-auto text-center"
          >
            Checkout was canceled — your bag is still saved.
          </div>
        )}
        <div className="flex justify-center items-center space-x-4">
          <h1 className="text-4xl font-extrabold">SHOPPING</h1>
          <h1 className="text-4xl font-bold text-gray-700">BAG</h1>
        </div>
        {cartItems.length === 0 ? (
          <p className="text-center text-gray-400">Your cart is empty.</p>
        ) : (
          <div>
            {catalogError && (
              <div
                role="alert"
                className="mb-4 p-3 rounded border border-red-700 bg-red-950 text-red-100 text-sm"
              >
                {catalogError}
              </div>
            )}
            {reconcileNotice && (
              <div
                role="status"
                className="mb-4 p-3 rounded border border-amber-600 bg-amber-950 text-amber-100 text-sm"
              >
                <p className="mb-2">{reconcileNotice}</p>
                <button
                  type="button"
                  onClick={clearReconcileNotice}
                  className="text-amber-200 underline text-xs"
                >
                  Dismiss
                </button>
              </div>
            )}
            {!checkoutAllowed && validations && catalogList && (
              <div
                role="alert"
                className="mb-4 p-3 rounded border border-red-600 bg-red-950/80 text-red-100 text-sm"
              >
                <p className="font-semibold mb-1">Fix your bag before checkout</p>
                <ul className="list-disc list-inside space-y-1">
                  {validations
                    .filter((v) => v.issues.length > 0)
                    .map((v) => (
                      <li key={lineKey(v.line)}>
                        <span className="font-medium">{v.line.name}: </span>
                        {v.issues.map((i) => i.message).join(" ")}
                      </li>
                    ))}
                </ul>
              </div>
            )}
            {quoteError && (
              <div
                role="alert"
                className="mb-4 p-3 rounded border border-amber-600 bg-amber-950 text-amber-100 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <span>{quoteError}</span>
                <button
                  type="button"
                  onClick={refetchQuote}
                  className="text-amber-200 underline text-sm"
                >
                  Retry
                </button>
              </div>
            )}
            {quoteLoading && checkoutDrafts.length > 0 && !quote && (
              <p className="text-center text-sm text-gray-400 mb-2" role="status">
                Loading prices from catalog…
              </p>
            )}
            <div className="mb-4 bg-black p-3 rounded shadow border border-gray-600">
              <p className="text-center text-sm font-bold text-green-400">
                {progressMessage}
              </p>
              <div className="relative h-2 bg-gray-800 rounded mt-2">
                <div
                  className="absolute top-0 left-0 h-full bg-green-500 rounded"
                  style={{ width: `${Math.min((progressSubtotalDollars / 50) * 100, 100)}%` }}
                />
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
                  {cartItems.map((item, itemIndex) => {
                    const key = lineKey(item);
                    const v = validationByKey.get(key);
                    const lineQ = lineQuoteByCartIndex.get(itemIndex);
                    const unit =
                      v?.displayUnitPrice != null ? v.displayUnitPrice : item.price;
                    const lineTotal = unit * item.quantity;
                    const skuForQuote = normalizeLineSku(item.sku);
                    const awaitingCatalogPrice =
                      quoteLoading && !lineQ && skuForQuote !== "";
                    const unitDisplay = lineQ
                      ? formatCents(lineQ.unit_cents)
                      : awaitingCatalogPrice
                        ? "…"
                        : `$${unit.toFixed(2)}`;
                    const lineTotalDisplay = lineQ
                      ? formatCents(lineQ.line_cents)
                      : awaitingCatalogPrice
                        ? "…"
                        : `$${lineTotal.toFixed(2)}`;
                    const plusDisabled = incrementDisabled(v);
                    return (
                      <tr
                        key={key}
                        className="border-b border-gray-700 hover:bg-gray-800"
                        aria-describedby={
                          v && v.issues.length > 0 ? `issues-${key}` : undefined
                        }
                      >
                        <td className="py-4 px-6 flex flex-col sm:flex-row gap-4 items-center">
                          <img
                            src={item.image || "/assets/img/Listing.jpeg"}
                            alt=""
                            className="w-16 h-16 object-contain border border-gray-600 rounded bg-white sm:w-20 sm:h-20"
                          />
                          <div className="text-center sm:text-left">
                            <p className="font-medium text-sm text-white">{item.name}</p>
                            <p className="text-sm text-gray-400">
                              Estimated delivery: 3-5 days
                            </p>
                            {v && v.issues.length > 0 && (
                              <ul
                                id={`issues-${key}`}
                                className="text-red-400 text-sm mt-2 list-disc list-inside text-left"
                              >
                                {v.issues.map((issue) => (
                                  <li key={issue.code}>{issue.message}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center font-semibold text-white">
                          {lineQ && (
                            <span className="block text-xs text-gray-500 font-normal" aria-hidden>
                              Catalog
                            </span>
                          )}
                          {unitDisplay}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div
                            className="flex flex-col items-center justify-center md:flex-row md:gap-2"
                            role="group"
                            aria-labelledby={`qty-label-${key}`}
                          >
                            <span
                              id={`qty-label-${key}`}
                              className="font-semibold text-white md:hidden mb-1"
                            >
                              Quantity
                            </span>
                            <button
                              type="button"
                              onClick={() => removeFromCart(item.id, item.sku)}
                              className="bg-gray-700 text-white px-2 py-1 rounded hover:bg-gray-500"
                              aria-label={`Decrease quantity for ${item.name}`}
                            >
                              -
                            </button>
                            <span className="font-semibold text-white" aria-live="polite">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => addToCart(item)}
                              disabled={plusDisabled}
                              className="bg-gray-700 text-white px-2 py-1 rounded hover:bg-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
                              aria-label={`Increase quantity for ${item.name}`}
                            >
                              +
                            </button>
                          </div>
                          {v &&
                            v.issues.length === 0 &&
                            v.maxQuantity != null &&
                            item.quantity >= v.maxQuantity && (
                              <p className="text-amber-400 text-xs mt-1 max-w-[12rem] mx-auto">
                                Maximum {v.maxQuantity} available.
                              </p>
                            )}
                        </td>
                        <td className="py-4 px-6 text-center font-bold text-white">
                          {lineTotalDisplay}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              removeFromCart(item.id, item.sku);
                            }}
                            className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-6 bg-black p-4 rounded shadow border border-gray-600">
                <p className="text-lg font-semibold text-white">
                  Subtotal:{" "}
                  {quote
                    ? formatCents(quote.subtotal_cents)
                    : quoteLoading
                      ? "…"
                      : `$${subtotal.toFixed(2)}`}
                </p>
                <p className="text-sm text-gray-400">
                  {quote
                    ? "Prices and subtotal are from the current catalog. Shipping and taxes are at checkout."
                    : "Shipping and taxes calculated at checkout."}
                </p>
              </div>

              <div className="mt-6 flex justify-between items-center bg-black p-4 rounded shadow border border-gray-600">
                <input
                  type="text"
                  placeholder="Enter coupon code"
                  className="w-2/3 p-2 border border-gray-600 rounded bg-gray-800 text-white"
                />
                <button
                  type="button"
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Apply Coupon
                </button>
              </div>

              <div className="mt-6 flex justify-between">
                <button
                  type="button"
                  onClick={() => navigate("/products")}
                  className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600"
                >
                  Continue Shopping
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate("/checkout", { state: { subtotal, items: cartItems } })
                  }
                  disabled={!checkoutAllowed}
                  className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Proceed to Checkout
                </button>
              </div>

              <div className="mt-6 flex justify-center gap-4">
                <div className="flex items-center">
                  <FontAwesomeIcon
                    icon={faLock}
                    className="text-gray-500 mr-2 text-lg"
                    aria-hidden
                  />
                  <span className="text-gray-500">Secure Payment</span>
                </div>

                <div className="flex items-center">
                  <FontAwesomeIcon
                    icon={faUndoAlt}
                    className="text-gray-500 mr-2 text-lg"
                    aria-hidden
                  />
                  <span className="text-gray-500">Free Returns</span>
                </div>

                <div className="flex items-center">
                  <FontAwesomeIcon
                    icon={faCheckCircle}
                    className="text-gray-500 mr-2 text-lg"
                    aria-hidden
                  />
                  <span className="text-gray-500">Satisfaction Guaranteed</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default CartPage;
