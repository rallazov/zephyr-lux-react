import React from "react";
import { formatPageTitleWithBrand, usePageMeta } from "../../seo/meta";

function supportEmailFromEnv(): string {
  const raw = import.meta.env.VITE_SUPPORT_EMAIL?.trim();
  if (raw) return raw;
  return "support@zephyrlux.com";
}

const ContactPage: React.FC = () => {
  const supportEmail = supportEmailFromEnv();
  usePageMeta({
    title: formatPageTitleWithBrand("Contact"),
    description: "Contact Zephyr Lux for order questions, sizing, or returns.",
    canonicalPath: "/contact",
  });
  return (
    <main className="contact-page min-h-[50vh] bg-neutral-900 text-neutral-100">
      <div className="prose prose-invert prose-headings:text-neutral-100 prose-a:text-neutral-200 hover:prose-a:text-white max-w-prose mx-auto px-4 py-10 lg:py-14">
        <h1>Contact us</h1>
        <p>
          For order status, sizing help, or returns, email us—we typically reply within one to two business days. Include
          your order number if you have one.
        </p>
        <h2>Email</h2>
        <p>
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
        </p>
        <h2>Support hours</h2>
        <p>
          We read and answer messages Monday–Friday, 9:00 a.m.–5:00 p.m. Pacific Time, excluding U.S. holidays. Messages
          sent outside those hours are queued for the next business day.
        </p>
        <h2>Fulfillment &amp; visits</h2>
        <p>
          Zephyr Lux is an online storefront—we ship to the address you provide at checkout. We do not operate a public
          showroom. Return instructions and any mailing addresses for exchanges appear on your packing slip or in your
          order correspondence once a return is approved.
        </p>
      </div>
    </main>
  );
};

export default ContactPage;
