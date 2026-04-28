import React, { useState } from "react";
import { formatPageTitleWithBrand, usePageMeta } from "../seo/meta";
import {
  ORDER_LOOKUP_NEUTRAL_MESSAGE,
  getOrderLookupFieldErrors,
  parseOrderLookupRequest,
  type OrderLookupFieldErrors,
} from "./orderLookupRequest";

const SUPPORT_MAIL = "mailto:support@zephyrlux.com";

const OrderStatusLookup: React.FC = () => {
  const [email, setEmail] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [fieldErrors, setFieldErrors] = useState<OrderLookupFieldErrors>({});
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "success" | "error">(
    "idle",
  );

  usePageMeta({
    title: formatPageTitleWithBrand("Order status"),
    description: "Request secure access to your Zephyr Lux order status.",
    canonicalPath: "/order-status",
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitState("idle");

    const parsed = parseOrderLookupRequest({
      email,
      order_number: orderNumber,
    });

    if (!parsed.success) {
      setFieldErrors(getOrderLookupFieldErrors(parsed.error));
      return;
    }

    setFieldErrors({});
    setEmail(parsed.data.email);
    setOrderNumber(parsed.data.order_number);
    setSubmitState("submitting");

    try {
      const response = await fetch("/api/order-lookup-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) throw new Error("lookup request failed");
      setSubmitState("success");
    } catch {
      setSubmitState("error");
    }
  }

  const emailErrorId = "order-status-email-error";
  const orderNumberErrorId = "order-status-order-number-error";

  return (
    <main className="min-h-[70vh] bg-stone-950 text-stone-50">
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-16">
        <div className="flex flex-col justify-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-400">
            Guest order help
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
            Order status
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-stone-300">
            Enter the email used at checkout and your Zephyr Lux order number. We will send a
            private link when those details match our records.
          </p>
          <p className="mt-6 max-w-xl text-sm leading-6 text-stone-400">
            Need help right away?{" "}
            <a className="font-medium text-neutral-300 underline-offset-4 hover:text-red-400 hover:underline" href={SUPPORT_MAIL}>
              Email support
            </a>
            .
          </p>
        </div>

        <form
          noValidate
          aria-busy={submitState === "submitting"}
          className="w-full border border-stone-700 bg-stone-900/80 p-5 shadow-2xl shadow-black/20 sm:p-6"
          onSubmit={handleSubmit}
        >
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-stone-100" htmlFor="order-status-email">
                Email address
              </label>
              <input
                autoComplete="email"
                className="mt-2 block min-h-12 w-full rounded-md border border-stone-600 bg-stone-950 px-4 py-3 text-base text-stone-50 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/30"
                id="order-status-email"
                inputMode="email"
                name="email"
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (fieldErrors.email) setFieldErrors((current) => ({ ...current, email: undefined }));
                }}
                aria-describedby={fieldErrors.email ? emailErrorId : undefined}
                aria-invalid={Boolean(fieldErrors.email)}
                type="email"
                value={email}
              />
              {fieldErrors.email && (
                <p className="mt-2 text-sm text-red-300" id={emailErrorId} role="alert">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <label
                className="block text-sm font-medium text-stone-100"
                htmlFor="order-status-order-number"
              >
                Order number
              </label>
              <input
                autoCapitalize="characters"
                autoComplete="off"
                className="mt-2 block min-h-12 w-full rounded-md border border-stone-600 bg-stone-950 px-4 py-3 font-mono text-base uppercase text-stone-50 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/30"
                id="order-status-order-number"
                inputMode="text"
                name="order_number"
                onChange={(event) => {
                  setOrderNumber(event.target.value);
                  if (fieldErrors.order_number) {
                    setFieldErrors((current) => ({ ...current, order_number: undefined }));
                  }
                }}
                aria-describedby={fieldErrors.order_number ? orderNumberErrorId : undefined}
                aria-invalid={Boolean(fieldErrors.order_number)}
                placeholder="ZLX-20260428-0001"
                value={orderNumber}
              />
              {fieldErrors.order_number && (
                <p className="mt-2 text-sm text-red-300" id={orderNumberErrorId} role="alert">
                  {fieldErrors.order_number}
                </p>
              )}
            </div>
          </div>

          <button
            className="mt-6 min-h-12 w-full rounded-md bg-red-600 px-5 py-3 text-base font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-stone-600 disabled:text-stone-300"
            disabled={submitState === "submitting"}
            type="submit"
          >
            {submitState === "submitting" ? "Sending..." : "Send secure link"}
          </button>

          {submitState === "submitting" && (
            <p className="mt-4 text-sm text-stone-300" role="status">
              Sending request...
            </p>
          )}
          {submitState === "success" && (
            <p className="mt-4 rounded-md border border-neutral-600 bg-neutral-900 px-4 py-3 text-sm text-neutral-200" role="status">
              {ORDER_LOOKUP_NEUTRAL_MESSAGE}
            </p>
          )}
          {submitState === "error" && (
            <p className="mt-4 rounded-md border border-red-500/40 bg-red-950/50 px-4 py-3 text-sm text-red-100" role="alert">
              We could not send the request right now. Please try again or email support.
            </p>
          )}
        </form>
      </section>
    </main>
  );
};

export default OrderStatusLookup;
