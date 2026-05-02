import React, { useState } from "react";
import { faArrowRight, faEnvelope, faLock } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { formatPageTitleWithBrand, usePageMeta } from "../seo/meta";
import {
  ORDER_LOOKUP_NEUTRAL_MESSAGE,
  getOrderLookupFieldErrors,
  parseOrderLookupRequest,
  type OrderLookupFieldErrors,
} from "./orderLookupRequest";
import { apiUrl } from "../lib/apiBase";
import "./OrderStatusLookup.css";

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
      const response = await fetch(apiUrl("/api/order-lookup-request"), {
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
  const emailDescribedBy = fieldErrors.email ? emailErrorId : undefined;
  const orderNumberDescribedBy = fieldErrors.order_number
    ? orderNumberErrorId
    : "order-status-order-number-hint";

  return (
    <main className="order-lookup-page">
      <section className="order-lookup-page__shell">
        <div className="order-lookup-page__intro">
          <p className="order-lookup-page__eyebrow">Guest order lookup</p>
          <h1>Order status</h1>
          <p className="order-lookup-page__copy">
            Request a private order-status link using the email from checkout and your
            Zephyr Lux order number.
          </p>
          <div className="order-lookup-page__support">
            <span className="order-lookup-page__support-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faLock} />
            </span>
            <p>
              Need help right away?{" "}
              <a href={SUPPORT_MAIL}>Email support</a>
            </p>
          </div>
        </div>

        <form
          noValidate
          aria-busy={submitState === "submitting"}
          className="order-lookup-form"
          onSubmit={handleSubmit}
        >
          <div className="order-lookup-form__header">
            <p className="order-lookup-form__kicker">Secure link request</p>
            <p className="order-lookup-form__note">No account required</p>
          </div>

          <div className="order-lookup-form__fields">
            <div className="order-lookup-form__field">
              <label className="order-lookup-form__label" htmlFor="order-status-email">
                Email address
              </label>
              <input
                autoComplete="email"
                className="order-lookup-form__input"
                id="order-status-email"
                inputMode="email"
                name="email"
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (fieldErrors.email) setFieldErrors((current) => ({ ...current, email: undefined }));
                }}
                aria-describedby={emailDescribedBy}
                aria-invalid={Boolean(fieldErrors.email)}
                type="email"
                value={email}
              />
              {fieldErrors.email && (
                <p className="order-lookup-form__error" id={emailErrorId} role="alert">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div className="order-lookup-form__field">
              <label
                className="order-lookup-form__label"
                htmlFor="order-status-order-number"
              >
                Order number
              </label>
              <input
                autoCapitalize="characters"
                autoComplete="off"
                className="order-lookup-form__input order-lookup-form__input--order"
                id="order-status-order-number"
                inputMode="text"
                name="order_number"
                onChange={(event) => {
                  setOrderNumber(event.target.value);
                  if (fieldErrors.order_number) {
                    setFieldErrors((current) => ({ ...current, order_number: undefined }));
                  }
                }}
                aria-describedby={orderNumberDescribedBy}
                aria-invalid={Boolean(fieldErrors.order_number)}
                placeholder="ZLX-20260428-0001"
                value={orderNumber}
              />
              {!fieldErrors.order_number && (
                <p className="order-lookup-form__hint" id="order-status-order-number-hint">
                  Example: ZLX-20260428-0001
                </p>
              )}
              {fieldErrors.order_number && (
                <p className="order-lookup-form__error" id={orderNumberErrorId} role="alert">
                  {fieldErrors.order_number}
                </p>
              )}
            </div>
          </div>

          <button
            className="order-lookup-form__submit"
            disabled={submitState === "submitting"}
            type="submit"
          >
            <FontAwesomeIcon icon={submitState === "submitting" ? faEnvelope : faArrowRight} />
            <span>{submitState === "submitting" ? "Sending..." : "Send secure link"}</span>
          </button>

          {submitState === "submitting" && (
            <p className="order-lookup-form__status" role="status">
              Sending request...
            </p>
          )}
          {submitState === "success" && (
            <p className="order-lookup-form__status order-lookup-form__status--success" role="status">
              {ORDER_LOOKUP_NEUTRAL_MESSAGE}
            </p>
          )}
          {submitState === "error" && (
            <p className="order-lookup-form__status order-lookup-form__status--error" role="alert">
              We could not send the request right now. Please try again or email support.
            </p>
          )}
        </form>
      </section>
    </main>
  );
};

export default OrderStatusLookup;
