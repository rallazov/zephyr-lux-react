import React from "react";
import { formatPageTitleWithBrand, usePageMeta } from "../../seo/meta";
import PolicyLayout from "./PolicyLayout";

const PolicyTermsPage: React.FC = () => {
  usePageMeta({
    title: formatPageTitleWithBrand("Terms of use"),
    description: "Terms governing use of the Zephyr Lux website, products, pricing, and limitations of liability.",
    canonicalPath: "/policies/terms",
  });
  return (
    <PolicyLayout title="Terms of use">
      <p>
        By shopping at or browsing zephyrlux.com (the &quot;site&quot;), you agree to these terms. They are written for
        clarity for everyday customers; they are not a substitute for jurisdiction-specific legal review if you need
        enforceable terms for a regulated business.
      </p>
      <h2>Use of the site</h2>
      <p>
        You agree to use the site only for lawful purchases and inquiries. We may refuse or cancel orders that appear
        fraudulent, are tied to inventory errors, or violate our policies. We may update product information, prices, or
        availability at any time; if we change a price after you ordered, we will contact you before charging more than
        you agreed to at checkout.
      </p>
      <h2>Products and pricing</h2>
      <p>
        We aim for accurate descriptions, imagery, and sizing guidance, but minor variations in color or hand-feel can
        occur. Taxes and shipping are calculated at checkout where applicable. Title and risk of loss for physical goods
        pass to you when the carrier records delivery, unless a carrier claim or our return policy says otherwise.
      </p>
      <h2>Intellectual property</h2>
      <p>
        Site content—logos, product photos, and editorial copy—is owned by Zephyr Lux or its licensors. Do not copy,
        scrape, or reuse it for commercial purposes without written permission.
      </p>
      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, Zephyr Lux and its suppliers are not liable for indirect, incidental, or
        consequential damages arising from use of the site or products. Our total liability for any claim related to a
        product you purchased is limited to the amount you paid for that product. Some jurisdictions do not allow certain
        limitations; those limits apply only to the fullest extent allowed in your region.
      </p>
    </PolicyLayout>
  );
};

export default PolicyTermsPage;
