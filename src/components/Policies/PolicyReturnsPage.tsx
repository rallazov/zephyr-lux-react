import React from "react";
import { Link } from "react-router-dom";
import { formatPageTitleWithBrand, usePageMeta } from "../../seo/meta";
import PolicyLayout from "./PolicyLayout";

const PolicyReturnsPage: React.FC = () => {
  usePageMeta({
    title: formatPageTitleWithBrand("Returns policy"),
    description: "Returns and exchanges policy for Zephyr Lux.",
    canonicalPath: "/policies/returns",
  });
  return (
    <PolicyLayout title="Returns">
      <p>
        Replace eligibility windows, conditions, refund methods, and restocking rules with your actual return program
        before launch.
      </p>
      <h2>General</h2>
      <p>
        If an item does not meet your expectations, you may be able to return it in unused condition with original
        packaging where applicable. Final sale or hygiene-sensitive items may be excluded—list those categories
        explicitly.
      </p>
      <h2>How to start a return</h2>
      <p>
        Contact us using the information on the{" "}
        <Link to="/contact">contact page</Link>. Include your order number and the items you wish to return. We will
        confirm next steps.
      </p>
      <h2>Refunds</h2>
      <p>
        Approved refunds are typically issued to the original payment method after the return is received and inspected.
        Timing depends on your payment processor and bank.
      </p>
    </PolicyLayout>
  );
};

export default PolicyReturnsPage;
