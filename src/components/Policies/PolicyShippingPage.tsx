import React from "react";
import { formatPageTitleWithBrand, usePageMeta } from "../../seo/meta";
import PolicyLayout from "./PolicyLayout";

const PolicyShippingPage: React.FC = () => {
  usePageMeta({
    title: formatPageTitleWithBrand("Shipping policy"),
    description:
      "How Zephyr Lux processes and ships orders—timing, carriers, domestic delivery, and international availability.",
    canonicalPath: "/policies/shipping",
  });
  return (
    <PolicyLayout title="Shipping">
      <p>
        This policy describes how Zephyr Lux prepares and delivers online orders. Carriers, transit times, and regions we
        serve may change; we will note material updates on this page when we can.
      </p>
      <h2>Order processing</h2>
      <p>
        After checkout, we typically verify payment and allocate inventory within one to three business days (often
        sooner). During launches, holidays, or inventory restocks, processing may take longer—we will email you if
        there is an unexpected delay.
      </p>
      <h2>Domestic (U.S.) delivery</h2>
      <p>
        We ship to valid street addresses within the United States using major parcel carriers. You will receive a
        confirmation email with tracking when your package leaves our fulfillment partner, when tracking is available for
        your service level.
      </p>
      <h2>International</h2>
      <p>
        International shipping is available only where shown at checkout. Import duties, taxes, and carrier brokerage
        fees are the buyer&apos;s responsibility unless we state otherwise during checkout. Delivery times vary by
        destination and customs processing.
      </p>
      <h2>Split shipments</h2>
      <p>
        If part of your order ships separately, you may receive more than one package and more than one tracking
        number. You are only charged for shipping as displayed at checkout unless we contact you first to approve a
        change.
      </p>
    </PolicyLayout>
  );
};

export default PolicyShippingPage;
