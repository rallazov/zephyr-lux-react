import React from "react";

type PolicyLayoutProps = {
  title: string;
  children: React.ReactNode;
};

/** Shared wrapper for policy/legal pages; uses Tailwind Typography (`prose`). */
const PolicyLayout: React.FC<PolicyLayoutProps> = ({ title, children }) => {
  return (
    <main className="policy-page min-h-[50vh] bg-neutral-900 text-neutral-100">
      {/* Template — replace before production: legal copy and business-specific claims must be reviewed by the owner. */}
      <div className="prose prose-invert prose-headings:text-neutral-100 prose-a:text-red-400 hover:prose-a:text-red-300 max-w-prose mx-auto px-4 py-10 lg:py-14">
        <h1>{title}</h1>
        {children}
      </div>
    </main>
  );
};

export default PolicyLayout;
