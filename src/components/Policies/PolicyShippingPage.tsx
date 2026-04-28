import React from "react";
import { formatPageTitleWithBrand, usePageMeta } from "../../seo/meta";
import PolicyLayout from "./PolicyLayout";

const PolicyShippingPage: React.FC = () => {
  usePageMeta({
    title: formatPageTitleWithBrand("Shipping policy"),
    description: "Shipping and delivery policy for Zephyr Lux orders.",
    canonicalPath: "/policies/shipping",
  });
  return (
    <PolicyLayout title="Shipping">
      <p>
        This page describes how orders are prepared and delivered in general terms. Replace all timeframes, regions,
        carriers, and fees with your real operations before production.
      </p>
      <h2>Processing</h2>
      <p>
        Orders are typically processed within a few business days. Peak periods or inventory checks may add delay.
        You will receive an email update when the order ships or if something prevents shipment.
      </p>
      <h2>Delivery</h2>
      <p>
        Standard delivery is via common parcel carriers to the address provided at checkout. Transit time depends on
        the carrier and destination; tracking is provided when available.
      </p>
      <h2>International</h2>
      <p>
        If you ship internationally, list countries, duties, taxes, and customs rules here. Until then, state clearly
        which regions you serve.
      </p>
    </PolicyLayout>
  );
};

export default PolicyShippingPage;
