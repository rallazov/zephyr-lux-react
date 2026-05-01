import React from "react";
import { Link } from "react-router-dom";
import { formatPageTitleWithBrand, usePageMeta } from "../../seo/meta";
import PolicyLayout from "./PolicyLayout";

const PolicyReturnsPage: React.FC = () => {
  usePageMeta({
    title: formatPageTitleWithBrand("Returns policy"),
    description:
      "Returns and exchanges at Zephyr Lux—eligibility, timelines, and how to start a return or exchange.",
    canonicalPath: "/policies/returns",
  });
  return (
    <PolicyLayout title="Returns">
      <p>
        We want you to be happy with Zephyr Lux pieces. This policy explains typical eligibility for returns and
        exchanges, how to request one, and how refunds are issued.
      </p>
      <h2>Eligibility</h2>
      <p>
        For most unworn items with original tags attached and packaging intact, we accept return requests within thirty
        (30) days of delivery, unless an item is marked final sale at purchase or falls under hygiene-sensitive or
        intimate categories that cannot be restocked once opened. If you are unsure whether your item qualifies, email us
        on the{" "}
        <Link to="/contact" className="text-neutral-200 hover:text-white">
          contact page
        </Link>{" "}
        before shipping anything back.
      </p>
      <h2>How to start a return</h2>
      <p>
        Email us using the{" "}
        <Link to="/contact" className="text-neutral-200 hover:text-white">
          contact page
        </Link>{" "}
        with your order number, the items you wish to return, and whether you prefer a refund or exchange where
        inventory allows. We will confirm instructions, including the return address or prepaid label if we provide
        one for your case.
      </p>
      <h2>Refunds</h2>
      <p>
        Approved refunds are applied to your original payment method after we receive and inspect the return.
        Processing usually takes several business days on our side; your bank may need additional time to post the
        credit. Original shipping charges are non-refundable unless we made an error or an item arrived damaged or
        mislabeled.
      </p>
    </PolicyLayout>
  );
};

export default PolicyReturnsPage;
