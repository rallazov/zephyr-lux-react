import React from "react";
import { formatPageTitleWithBrand, usePageMeta } from "../../seo/meta";
import PolicyLayout from "./PolicyLayout";

const PolicyTermsPage: React.FC = () => {
  usePageMeta({
    title: formatPageTitleWithBrand("Terms of use"),
    description: "Terms of use for the Zephyr Lux storefront.",
    canonicalPath: "/policies/terms",
  });
  return (
    <PolicyLayout title="Terms of use">
      <p>
        These terms are generic placeholder language. Replace with jurisdiction-appropriate terms reviewed by legal
        counsel before relying on them in production.
      </p>
      <h2>Use of the site</h2>
      <p>
        You agree to use this storefront only for lawful purposes and in line with posted policies. We may update the
        site, prices, or availability and may limit orders that appear fraudulent or mistaken.
      </p>
      <h2>Products and pricing</h2>
      <p>
        Descriptions and images are for general reference. Minor variations can occur. Taxes and shipping are
        calculated at checkout where applicable.
      </p>
      <h2>Limitation of liability</h2>
      <p>
        To the extent permitted by law, the site and services are provided as-is. Your counsel should tailor this
        section for your entity and region.
      </p>
    </PolicyLayout>
  );
};

export default PolicyTermsPage;
