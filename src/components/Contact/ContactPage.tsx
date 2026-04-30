import React from "react";
import { formatPageTitleWithBrand, usePageMeta } from "../../seo/meta";

const SUPPORT_EMAIL = "support@zephyrlux.example";

const ContactPage: React.FC = () => {
  usePageMeta({
    title: formatPageTitleWithBrand("Contact"),
    description: "Contact Zephyr Lux for order questions, sizing, or returns.",
    canonicalPath: "/contact",
  });
  return (
    <main className="contact-page min-h-[50vh] bg-neutral-900 text-neutral-100">
      {/* Template — replace before production: SUPPORT_EMAIL, hours, and address must reflect real operations. */}
      <div className="prose prose-invert prose-headings:text-neutral-100 prose-a:text-neutral-200 hover:prose-a:text-white max-w-prose mx-auto px-4 py-10 lg:py-14">
        <h1>Contact us</h1>
        <p>
          For order questions, sizing, or returns, reach out using the email below. Replace the placeholder address
          and hours with your production support details.
        </p>
        <h2>Email</h2>
        <p>
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
        <h2>Support hours (placeholder)</h2>
        <p>Monday–Friday, 9:00–17:00 (local time — specify timezone before launch).</p>
        <h2>Physical fulfillment</h2>
        <p>
          If you publish a returns address or corporate office, add it here. Do not invent a real street address for
          placeholder content.
        </p>
      </div>
    </main>
  );
};

export default ContactPage;
