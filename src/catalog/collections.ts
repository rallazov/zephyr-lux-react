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
    heroTitle: "Women’s essentials",
    heroDescription:
      "Soft layers and elevated basics—pieces you’ll reach for on repeat, cut for comfort and polish.",
    heroImage: "/assets/img/women_placeholder.jpeg",
  },
  {
    path: "/men",
    navLabel: "Men",
    categoryKey: "men",
    heroTitle: "Refined everyday wear",
    heroDescription: "Quiet luxury for daily routines—tailored fit, premium fabrics, and ease that lasts.",
    heroImage: "/assets/img/Lifestyle.jpeg",
  },
  {
    path: "/underwear",
    navLabel: "Underwear",
    categoryKey: "underwear",
    heroTitle: "The foundation layer",
    heroDescription:
      "Breathable, precise fit—underwear and base layers built to feel invisible under everything else.",
    heroImage: "/assets/img/Lifestyle.jpeg",
  },
  {
    path: "/kids",
    navLabel: "Kids",
    categoryKey: "kids",
    heroTitle: "Little wardrobe staples",
    heroDescription:
      "Durable, easy-care comfort for busy days—sizes and colors that keep up with real family life.",
    heroImage: "/assets/img/kids_placeholder.jpeg",
  },
  {
    path: "/sale",
    navLabel: "Sale",
    categoryKey: "sale",
    heroTitle: "Sale edit",
    heroDescription:
      "A rotating selection of reduced styles—availability, sizes, and pricing can change quickly.",
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
