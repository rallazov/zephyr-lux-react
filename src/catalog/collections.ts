/**
 * Single source of truth for storefront collection routes, nav labels, and hero copy.
 * URL paths are stable for SEO/metadata follow-ups (story 6-5).
 *
 * Hero art: only the underwear collection uses real boxer photography; other collections
 * use SVG placeholders until category-specific shoots exist.
 */
import {
  MENS_BOXER_BRIEFS_PACK_IMAGE,
  PLACEHOLDER_IMAGE_KIDS,
  PLACEHOLDER_IMAGE_MEN_APPAREL,
  PLACEHOLDER_IMAGE_SALE,
  PLACEHOLDER_IMAGE_WOMEN,
} from "./pdpImage";

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
    heroImage: PLACEHOLDER_IMAGE_WOMEN,
  },
  {
    path: "/men",
    navLabel: "Men",
    categoryKey: "men",
    heroTitle: "Refined everyday wear",
    heroDescription: "Quiet luxury for daily routines—tailored fit, premium fabrics, and ease that lasts.",
    heroImage: PLACEHOLDER_IMAGE_MEN_APPAREL,
  },
  {
    path: "/underwear",
    navLabel: "Underwear",
    categoryKey: "underwear",
    heroTitle: "The foundation layer",
    heroDescription:
      "Breathable, precise fit—underwear and base layers built to feel invisible under everything else.",
    heroImage: MENS_BOXER_BRIEFS_PACK_IMAGE,
  },
  {
    path: "/kids",
    navLabel: "Kids",
    categoryKey: "kids",
    heroTitle: "Little wardrobe staples",
    heroDescription:
      "Durable, easy-care comfort for busy days—sizes and colors that keep up with real family life.",
    heroImage: PLACEHOLDER_IMAGE_KIDS,
  },
  {
    path: "/sale",
    navLabel: "Sale",
    categoryKey: "sale",
    heroTitle: "Sale edit",
    heroDescription:
      "A rotating selection of reduced styles—availability, sizes, and pricing can change quickly.",
    heroImage: PLACEHOLDER_IMAGE_SALE,
  },
] as const;

export function getCollectionByPath(pathname: string): CollectionRouteDef | undefined {
  const p =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return COLLECTION_ROUTES.find((c) => c.path === p);
}
