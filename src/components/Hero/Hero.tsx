import React from "react";
import { Link } from "react-router-dom";

const DEFAULT_IMAGE = "/assets/img/Lifestyle.jpeg";
const DEFAULT_TITLE = (
  <>
    Premium Comfort.
    <br />
    <span className="text-red-400">Bold Style.</span>
  </>
);
const DEFAULT_DESCRIPTION =
  "Experience unparalleled comfort with our premium collection of men's boxer briefs. Crafted for the modern man who demands quality.";

export type HeroProps = {
  image?: string;
  title?: React.ReactNode;
  description?: string;
  primaryTo?: string;
  primaryLabel?: string;
  secondaryTo?: string;
  secondaryLabel?: string;
};

export default function Hero({
  image = DEFAULT_IMAGE,
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  primaryTo = "/products",
  primaryLabel = "Shop Now",
  secondaryTo = "/products",
  secondaryLabel = "View Collection",
}: HeroProps) {
  return (
    <section className="relative h-80 w-full overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={image}
          alt="Premium boxer briefs lifestyle"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />
      </div>

      <div className="relative container mx-auto px-4 md:px-8 h-full flex items-center">
        <div className="max-w-3xl text-white">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">{title}</h1>
          <p className="text-sm md:text-lg text-white/90 mb-6">{description}</p>
          <div className="flex flex-wrap gap-3">
            <Link to={primaryTo}>
              <button type="button" className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-md">
                {primaryLabel}
              </button>
            </Link>
            <Link to={secondaryTo}>
              <button type="button" className="bg-white/10 border border-white/20 text-white px-6 py-2 rounded-md">
                {secondaryLabel}
              </button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
