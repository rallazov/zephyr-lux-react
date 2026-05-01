import React from "react";
import { Link } from "react-router-dom";
import { formatPageTitleWithBrand, usePageMeta } from "../../seo/meta";

const PoliciesIndex: React.FC = () => {
  usePageMeta({
    title: formatPageTitleWithBrand("Policies"),
    description:
      "Shipping, returns, privacy, and terms for shopping with Zephyr Lux—how we fulfill orders and handle your information.",
    canonicalPath: "/policies",
  });
  return (
    <main className="policy-index min-h-[50vh] bg-neutral-900 text-neutral-100">
      <div className="prose prose-invert prose-headings:text-neutral-100 prose-a:text-neutral-200 hover:prose-a:text-white max-w-prose mx-auto px-4 py-10 lg:py-14">
        <h1>Policies</h1>
        <p className="text-neutral-300">
          How Zephyr Lux handles shipping, returns, privacy, and use of this site. The pages below describe our current
          storefront practices in plain language.
        </p>
        <ul className="list-none pl-0 space-y-2 not-prose">
          <li>
            <Link to="/policies/shipping" className="text-neutral-200 hover:text-white">
              Shipping policy
            </Link>
          </li>
          <li>
            <Link to="/policies/returns" className="text-neutral-200 hover:text-white">
              Returns policy
            </Link>
          </li>
          <li>
            <Link to="/policies/privacy" className="text-neutral-200 hover:text-white">
              Privacy policy
            </Link>
          </li>
          <li>
            <Link to="/policies/terms" className="text-neutral-200 hover:text-white">
              Terms of use
            </Link>
          </li>
        </ul>
      </div>
    </main>
  );
};

export default PoliciesIndex;
