/**
 * Single source of truth for storefront collection routes, nav labels, and hero copy.
 * URL paths are stable for SEO/metadata follow-ups (story 6-5).
 */
export type CollectionRouteDef = {
  path: string;
  navLabel: string;
  categoryKey: string;
  heroTitle: string;
  heroDescription: string;
  heroImage: string;
};

export const COLLECTION_ROUTES: readonly CollectionRouteDef[] = [
  {
    path: "/women",
    navLabel: "Women",
    categoryKey: "women",
    heroTitle: "Empower Your Style",
    heroDescription: "Elegant, timeless, and curated for you.",
    heroImage: "/assets/img/women_placeholder.jpeg",
  },
  {
    path: "/men",
    navLabel: "Men",
    categoryKey: "men",
    heroTitle: "For the Modern Man",
    heroDescription: "Comfort meets style.",
    heroImage: "/assets/img/Lifestyle.jpeg",
  },
  {
    path: "/underwear",
    navLabel: "Underwear",
    categoryKey: "underwear",
    heroTitle: "Foundation Essentials",
    heroDescription: "Comfort-first basics that move with you.",
    heroImage: "/assets/img/Lifestyle.jpeg",
  },
  {
    path: "/kids",
    navLabel: "Kids",
    categoryKey: "kids",
    heroTitle: "Fun & Functional",
    heroDescription: "Comfort for the little ones.",
    heroImage: "/assets/img/kids_placeholder.jpeg",
  },
  {
    path: "/sale",
    navLabel: "Sale",
    categoryKey: "sale",
    heroTitle: "Limited Time Offers",
    heroDescription: "Grab the deals before they're gone!",
    heroImage: "/assets/img/sale_placeholder.jpeg",
  },
] as const;

export function getCollectionByPath(pathname: string): CollectionRouteDef | undefined {
  const p =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return COLLECTION_ROUTES.find((c) => c.path === p);
}
