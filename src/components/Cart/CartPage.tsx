import { faCheckCircle, faLock, faUndoAlt } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { normalizeLineSku } from "../../cart/lineKey";
import {
  cartHasUnpriceableLine,
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
import { formatPageTitleWithBrand, usePageMeta } from "../../seo/meta";

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
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const checkoutCanceled = searchParams.get("checkout") === "canceled";

  usePageMeta({
    title: formatPageTitleWithBrand("Your bag"),
    description: "Review items in your Zephyr Lux bag before checkout.",
    canonicalPath: location.pathname || "/cart",
  });

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

  const skipQuote = cartHasUnpriceableLine(validations);
  const { quote, loading: quoteLoading, error: quoteError, refetch: refetchQuote, drafts: checkoutDrafts } =
    useCartQuote(cartItems, { skip: skipQuote });

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

  const cartLineRows = useMemo(() => {
    return cartItems.map((item, itemIndex) => {
      const key = lineKey(item);
      const v = validationByKey.get(key);
      const lineQ = lineQuoteByCartIndex.get(itemIndex);
      const unit = v?.displayUnitPrice != null ? v.displayUnitPrice : item.price;
      const lineTotal = unit * item.quantity;
      const skuForQuote = normalizeLineSku(item.sku);
      const awaitingCatalogPrice = quoteLoading && !lineQ && skuForQuote !== "";
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
      const skuNorm = normalizeLineSku(item.sku);
      const variantLabel =
        skuNorm !== ""
          ? `SKU ${skuNorm}`
          : item.variant_id
            ? `Variant ${String(item.variant_id).slice(0, 8)}…`
            : null;
      return {
        key,
        item,
        itemIndex,
        v,
        lineQ,
        unitDisplay,
        lineTotalDisplay,
        plusDisabled,
        variantLabel,
      };
    });
  }, [cartItems, validationByKey, lineQuoteByCartIndex, quoteLoading]);

  const progressSubtotalDollars = quote ? quote.subtotal_cents / 100 : subtotal;

  const subtotalDisplay =
    quote
      ? formatCents(quote.subtotal_cents)
      : quoteLoading
        ? "…"
        : `$${subtotal.toFixed(2)}`;

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

      <main
        className={`pt-52 max-w-6xl mx-auto p-4 ${cartItems.length > 0 ? "pb-28 md:pb-4" : ""}`}
      >
        {checkoutCanceled && (
          <div
            role="status"
            className="mx-auto mb-6 max-w-2xl rounded-lg border border-zlx-border bg-zlx-surface p-3 text-center text-sm text-neutral-200"
          >
            Checkout was canceled — your bag is still saved.
          </div>
        )}
        <div className="mb-6 flex justify-center items-baseline space-x-4">
          <h1 className="text-4xl font-extrabold tracking-tight">SHOPPING</h1>
          <h1 className="text-4xl font-bold text-neutral-500">BAG</h1>
        </div>
        {cartItems.length === 0 ? (
          <p className="text-center text-gray-400">Your cart is empty.</p>
        ) : (
          <div>
            {catalogError && (
              <div
                role="alert"
              className="zlx-alert-danger mb-4 p-4 text-sm text-neutral-200"
              >
                {catalogError}
              </div>
            )}
            {reconcileNotice && (
              <div
                role="status"
                className="mb-4 rounded-lg border border-zlx-border bg-zlx-surface p-3 text-sm text-neutral-200"
              >
                <p className="mb-2">{reconcileNotice}</p>
                <button
                  type="button"
                  onClick={clearReconcileNotice}
                  className="text-neutral-400 underline text-xs hover:text-neutral-300"
                >
                  Dismiss
                </button>
              </div>
            )}
            {!checkoutAllowed && validations && catalogList && (
              <div
                role="alert"
                className="zlx-alert-danger mb-4 p-4 text-sm text-neutral-200"
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
                className="zlx-alert-danger mb-4 flex flex-col gap-2 p-4 text-sm text-neutral-200 sm:flex-row sm:items-center sm:justify-between"
              >
                <span>{quoteError}</span>
                <button
                  type="button"
                  onClick={refetchQuote}
                  className="zlx-btn-secondary rounded-md px-3 py-2 text-sm"
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
            <div className="zlx-card mb-6 p-4">
              <p className="text-center text-sm font-bold text-neutral-200">
                {progressMessage}
              </p>
              <div className="relative h-2 overflow-hidden rounded-full bg-neutral-800 mt-3">
                <div
                  className="absolute top-0 left-0 h-full rounded-full bg-zlx-progress"
                  style={{ width: `${Math.min((progressSubtotalDollars / 50) * 100, 100)}%` }}
                />
              </div>
            </div>

            <p className="md:hidden text-center text-xs text-gray-500 mb-3" role="note">
              Your running subtotal and checkout are pinned to the bottom on small screens — scroll up to
              change items.
            </p>

            <div className="md:hidden space-y-4">
              {cartLineRows.map(
                ({
                  key,
                  item,
                  v,
                  lineQ,
                  unitDisplay,
                  lineTotalDisplay,
                  plusDisabled,
                  variantLabel,
                }) => (
                  <article
                    key={key}
                    data-testid={`cart-line-mobile-${key}`}
                    className="zlx-card p-4"
                    aria-describedby={v && v.issues.length > 0 ? `issues-m-${key}` : undefined}
                  >
                    <div className="flex gap-3 min-w-0">
                      <img
                        src={item.image || "/assets/img/Listing.jpeg"}
                        alt=""
                        className="h-16 w-16 shrink-0 object-contain border border-gray-600 rounded bg-white"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-white break-words">{item.name}</p>
                        {variantLabel ? (
                          <p className="text-xs text-gray-400 mt-1 break-all">{variantLabel}</p>
                        ) : null}
                        <p className="text-xs text-gray-500 mt-1">Estimated delivery: 3–5 days</p>
                        {v && v.issues.length > 0 ? (
                          <ul
                            id={`issues-m-${key}`}
                            className="text-red-400 text-sm mt-2 list-disc list-inside"
                          >
                            {v.issues.map((issue) => (
                              <li key={issue.code}>{issue.message}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-500 text-xs">Price</p>
                        <p className="font-semibold text-white tabular-nums">
                          {lineQ ? (
                            <span className="block text-xs text-gray-500 font-normal" aria-hidden>
                              Catalog
                            </span>
                          ) : null}
                          {unitDisplay}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-500 text-xs">Line total</p>
                        <p className="font-bold text-white tabular-nums">{lineTotalDisplay}</p>
                      </div>
                    </div>
                    <div
                      className="mt-4 flex flex-wrap items-center justify-between gap-3"
                      role="group"
                      aria-label={`Quantity for ${item.name}`}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id, item.sku)}
                          className="min-h-11 min-w-11 shrink-0 rounded-lg border border-zlx-border bg-zlx-surface-2 text-white text-lg leading-none hover:bg-neutral-700"
                          aria-label={`Decrease quantity for ${item.name}`}
                        >
                          −
                        </button>
                        <span className="min-w-[2ch] text-center font-semibold text-white" aria-live="polite">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => addToCart(item)}
                          disabled={plusDisabled}
                          className="min-h-11 min-w-11 shrink-0 rounded-lg border border-zlx-border bg-zlx-surface-2 text-white text-lg leading-none hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label={`Increase quantity for ${item.name}`}
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id, item.sku)}
                        className="min-h-11 rounded-lg bg-zlx-danger px-4 text-sm font-medium text-white hover:bg-zlx-danger-hover"
                      >
                        Remove
                      </button>
                    </div>
                    {v &&
                    v.issues.length === 0 &&
                    v.maxQuantity != null &&
                    item.quantity >= v.maxQuantity ? (
                      <p className="text-neutral-400 text-xs mt-2">Maximum {v.maxQuantity} available.</p>
                    ) : null}
                  </article>
                ),
              )}
            </div>

            <div className="zlx-card hidden overflow-x-auto md:block">
              <table className="min-w-full table-auto border-collapse">
                <thead>
                  <tr className="text-white uppercase text-sm border-b border-neutral-800">
                    <th className="py-3 px-6 text-left">Product</th>
                    <th className="py-3 px-6 text-center">Price</th>
                    <th className="py-3 px-6 text-center">Quantity</th>
                    <th className="py-3 px-6 text-center">Total</th>
                    <th className="py-3 px-6 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cartLineRows.map(
                    ({
                      key,
                      item,
                      v,
                      lineQ,
                      unitDisplay,
                      lineTotalDisplay,
                      plusDisabled,
                      variantLabel,
                    }) => (
                      <tr
                        key={key}
                        className="border-b border-neutral-800 hover:bg-zlx-surface-2/70"
                        aria-describedby={
                          v && v.issues.length > 0 ? `issues-${key}` : undefined
                        }
                      >
                        <td className="py-4 px-6">
                          <div className="flex flex-col sm:flex-row gap-4 items-center">
                            <img
                              src={item.image || "/assets/img/Listing.jpeg"}
                              alt=""
                              className="w-16 h-16 object-contain border border-neutral-300 rounded-lg bg-white sm:w-20 sm:h-20"
                            />
                            <div className="text-center sm:text-left min-w-0">
                              <p className="font-medium text-sm text-white break-words">{item.name}</p>
                              {variantLabel ? (
                                <p className="text-xs text-gray-400 mt-1 break-all">{variantLabel}</p>
                              ) : null}
                              <p className="text-sm text-gray-400">Estimated delivery: 3-5 days</p>
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
                              className="min-h-11 min-w-11 rounded-lg border border-zlx-border bg-zlx-surface-2 text-white hover:bg-neutral-700"
                              aria-label={`Decrease quantity for ${item.name}`}
                            >
                              −
                            </button>
                            <span className="font-semibold text-white" aria-live="polite">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => addToCart(item)}
                              disabled={plusDisabled}
                              className="min-h-11 min-w-11 rounded-lg border border-zlx-border bg-zlx-surface-2 text-white hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed"
                              aria-label={`Increase quantity for ${item.name}`}
                            >
                              +
                            </button>
                          </div>
                          {v &&
                            v.issues.length === 0 &&
                            v.maxQuantity != null &&
                            item.quantity >= v.maxQuantity && (
                              <p className="text-neutral-400 text-xs mt-1 max-w-[12rem] mx-auto">
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
                            className="min-h-11 rounded-lg bg-zlx-danger px-4 text-white hover:bg-zlx-danger-hover"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

              <div className="zlx-card mt-6 p-5">
                <p className="text-xl font-extrabold text-white">
                  Subtotal: {subtotalDisplay}
                </p>
                <p className="text-sm text-gray-400">
                  {quote
                    ? "Prices and subtotal are from the current catalog. Shipping and taxes are at checkout."
                    : "Shipping and taxes calculated at checkout."}
                </p>
              </div>

              <div className="zlx-card mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <input
                  type="text"
                  placeholder="Enter coupon code"
                  className="w-full min-w-0 rounded-lg border border-zlx-border bg-zlx-input p-3 text-white sm:flex-1"
                />
                <button
                  type="button"
                  className="zlx-btn-secondary min-h-11 shrink-0 rounded-lg px-4 py-2 text-sm font-medium"
                >
                  Apply Coupon
                </button>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between sm:items-center">
                <button
                  type="button"
                  onClick={() => navigate("/products")}
                  className="zlx-btn-secondary min-h-11 w-full rounded-lg px-4 py-2 sm:w-auto"
                >
                  Continue Shopping
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate("/checkout", { state: { subtotal, items: cartItems } })
                  }
                  disabled={!checkoutAllowed}
                  className="zlx-btn-primary hidden min-h-12 items-center justify-center rounded-lg px-8 py-3 text-base font-extrabold disabled:cursor-not-allowed disabled:opacity-40 md:inline-flex"
                >
                  Proceed to Checkout
                </button>
              </div>

              <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
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

            <div
              className="md:hidden fixed bottom-0 left-0 right-0 z-20 border-t border-zlx-border bg-black/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(0,0,0,0.45)]"
              data-testid="cart-mobile-checkout-bar"
            >
              <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">Subtotal</p>
                  <p className="text-base font-semibold text-white tabular-nums truncate">{subtotalDisplay}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    navigate("/checkout", { state: { subtotal, items: cartItems } })
                  }
                  disabled={!checkoutAllowed}
                  className="zlx-btn-primary min-h-12 shrink-0 rounded-lg px-5 py-2 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Checkout
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default CartPage;
