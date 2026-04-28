import React from "react";
import { formatPageTitleWithBrand, usePageMeta } from "../../seo/meta";
import PolicyLayout from "./PolicyLayout";

const PolicyPrivacyPage: React.FC = () => {
  usePageMeta({
    title: formatPageTitleWithBrand("Privacy policy"),
    description: "Privacy policy for Zephyr Lux.",
    canonicalPath: "/policies/privacy",
  });
  return (
    <PolicyLayout title="Privacy">
      <p>
        This is a high-level, merchant-neutral summary. It is not legal advice and does not describe a specific
        company&apos;s data practices until you replace it with counsel-approved text.
      </p>
      <h2>Information we may collect</h2>
      <p>
        When you place an order or contact us, we may collect details needed to fulfill the request—such as name,
        email, shipping address, payment reference (handled by your payment provider), and messages you send.
      </p>
      <h2>How we use it</h2>
      <p>
        We use this information to process orders, communicate about the transaction, and improve the service. We do
        not sell personal information as a product; describe any advertising, analytics, or subprocessors you actually
        use.
      </p>
      <h2>Cookies and similar tech</h2>
      <p>
        The site may use cookies or local storage for essential functions (for example, cart or session). Document
        optional analytics cookies if you enable them.
      </p>
      <h2>Your choices</h2>
      <p>
        List the rights available in your jurisdiction (access, deletion, opt-out) and how customers can exercise them.
      </p>
    </PolicyLayout>
  );
};

export default PolicyPrivacyPage;
