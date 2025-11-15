import React from "react";
import { Link } from "react-router-dom";

export default function Hero() {
  return (
    <section className="relative h-80 w-full overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="/assets/img/Lifestyle.jpeg"
          alt="Premium boxer briefs lifestyle"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />
      </div>

      <div className="relative container mx-auto px-4 md:px-8 h-full flex items-center">
        <div className="max-w-3xl text-white">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">Premium Comfort.
            <br />
            <span className="text-indigo-400">Bold Style.</span>
          </h1>
          <p className="text-sm md:text-lg text-white/90 mb-6">
            Experience unparalleled comfort with our premium collection of men's boxer briefs.
            Crafted for the modern man who demands quality.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/products">
              <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-md">Shop Now</button>
            </Link>
            <Link to="/products">
              <button className="bg-white/10 border border-white/20 text-white px-6 py-2 rounded-md">View Collection</button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
