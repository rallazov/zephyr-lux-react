import React from "react";
import { Link } from "react-router-dom";

const DEFAULT_IMAGE = "/assets/img/Lifestyle.jpeg";
const DEFAULT_TITLE = (
  <>
    Zephyr Lux
    <br />
    <span className="text-neutral-200">Elevated essentials</span>
  </>
);
const DEFAULT_DESCRIPTION =
  "Thoughtfully made basics with premium materials—comfort you notice, quality that holds up wash after wash.";

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
          alt="Zephyr Lux — elevated everyday essentials, lifestyle photography"
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
              <button
                type="button"
                className="rounded-md bg-zlx-action px-6 py-2 font-semibold text-zlx-action-text hover:bg-zlx-action-hover"
              >
                {primaryLabel}
              </button>
            </Link>
            <Link to={secondaryTo}>
              <button type="button" className="zlx-btn-secondary px-6 py-2 rounded-md">
                {secondaryLabel}
              </button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
