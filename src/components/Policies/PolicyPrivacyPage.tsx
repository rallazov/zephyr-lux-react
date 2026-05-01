import React from "react";
import { Link } from "react-router-dom";
import { formatPageTitleWithBrand, usePageMeta } from "../../seo/meta";
import PolicyLayout from "./PolicyLayout";

const PolicyPrivacyPage: React.FC = () => {
  usePageMeta({
    title: formatPageTitleWithBrand("Privacy policy"),
    description:
      "How Zephyr Lux collects, uses, and protects personal information when you shop or contact us.",
    canonicalPath: "/policies/privacy",
  });
  return (
    <PolicyLayout title="Privacy">
      <p>
        Zephyr Lux respects your privacy. This page summarizes what we collect through the storefront, why we use it,
        and the choices available to you. It is not legal advice; have qualified counsel review your final policy if you
        operate this site as a business entity with specific regulatory obligations.
      </p>
      <h2>Information we collect</h2>
      <p>
        When you place an order, subscribe to email, or contact support, we may collect contact and order details such as
        name, email, shipping address, cart contents, order numbers, and messages you send. Payment card data is
        handled by our payment processor—we receive confirmation of payment, not your full card number.
      </p>
      <h2>How we use information</h2>
      <p>
        We use this information to fulfill orders, send transactional messages (confirmations, shipping updates),
        respond to support requests, and detect fraud or abuse. Where you opt in, we may also send marketing email; you
        can unsubscribe from those messages using the link in any marketing email.
      </p>
      <h2>Cookies and analytics</h2>
      <p>
        We use cookies or local storage needed for the shopping cart and site experience. If optional analytics are
        enabled in your environment, we scope events to pages and features—see our analytics configuration in code and
        any third-party provider you enable.
      </p>
      <h2>Retention and security</h2>
      <p>
        We retain order and support-related records as needed for taxes, chargebacks, and customer service, then delete
        or anonymize where appropriate. We apply sensible technical and organizational safeguards, but no online
        service is perfectly secure.
      </p>
      <h2>Your choices and questions</h2>
      <p>
        Depending on where you live, you may have rights to access, correct, or delete certain personal data. To
        exercise those rights or ask a privacy question, contact us via the{" "}
        <Link to="/contact" className="text-neutral-200 hover:text-white">
          contact page
        </Link>
        .
      </p>
    </PolicyLayout>
  );
};

export default PolicyPrivacyPage;
