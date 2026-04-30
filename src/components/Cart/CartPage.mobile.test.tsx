import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CART_LOCAL_STORAGE_KEY } from "../../cart/storage";
import { getDefaultCatalogAdapter } from "../../catalog/factory";
import { parseStaticCatalogData } from "../../catalog/parse";
import { CartProvider } from "../../context/CartContext";
import CartPage from "./CartPage";

vi.mock("../../catalog/factory", () => ({
  getDefaultCatalogAdapter: vi.fn(),
}));

vi.mock("../../hooks/useCartQuote", () => ({
  useCartQuote: () => ({
    quote: null,
    loading: false,
    error: null,
    refetch: () => {},
    drafts: [],
  }),
}));

const singleRow = parseStaticCatalogData([
  {
    id: 2,
    slug: "single",
    title: "Single Variant",
    status: "active",
    variants: [
      {
        sku: "S1",
        price_cents: 2000,
        currency: "USD",
        inventory_quantity: 3,
        status: "active",
      },
    ],
  },
]).listItems;

const row = singleRow[0];
const variant = row.product.variants.find((v) => v.sku === "S1")!;

function seedCart() {
  localStorage.setItem(
    CART_LOCAL_STORAGE_KEY,
    JSON.stringify({
      v: 1,
      items: [
        {
          id: row.storefrontProductId,
          name: row.product.title,
          quantity: 1,
          price: variant.price_cents / 100,
          image: row.heroImageUrl || "/assets/img/Listing.jpeg",
          sku: "S1",
          variant_id: variant.id,
          product_slug: row.product.slug,
        },
      ],
    }),
  );
}

function renderCart() {
  return render(
    <CartProvider>
      <MemoryRouter initialEntries={["/cart"]}>
        <CartPage />
      </MemoryRouter>
    </CartProvider>,
  );
}

describe("CartPage mobile layout (responsive markup contract)", () => {
  beforeEach(() => {
    localStorage.removeItem(CART_LOCAL_STORAGE_KEY);
    vi.mocked(getDefaultCatalogAdapter).mockReset();
    vi.mocked(getDefaultCatalogAdapter).mockReturnValue({
      listProducts: async () => singleRow,
      listProductsByCategory: async () => [],
      getProductBySlug: async () => null,
    });
  });

  it("ships stacked line cards, desktop table shell, pinned checkout hint, fixed bottom bar, and scroll clearance", async () => {
    seedCart();
    renderCart();

    const mobileLine = await screen.findByTestId(`cart-line-mobile-${row.storefrontProductId}::S1`);
    expect(mobileLine).toHaveClass("zlx-card");

    expect(screen.getByRole("columnheader", { name: /^product$/i })).toBeInTheDocument();

    expect(screen.getByRole("note")).toHaveTextContent(/pinned to the bottom on small screens/i);

    const main = screen.getByRole("main");
    expect(main.className).toMatch(/\bpb-28\b/);
    expect(main.className).toMatch(/\bmd:pb-4\b/);

    const mobileBar = screen.getByTestId("cart-mobile-checkout-bar");
    expect(mobileBar.className).toMatch(/\bmd:hidden\b/);
    expect(mobileBar.className).toMatch(/\bfixed\b/);
    expect(mobileBar.className).toMatch(/\bbottom-0\b/);
    expect(mobileBar.className).toMatch(/safe-area-inset-bottom/);

    const dec = within(mobileLine).getByRole("button", {
      name: /decrease quantity for single variant/i,
    });
    expect(dec).toHaveClass("min-h-11");

    const checkoutSticky = within(mobileBar).getByRole("button", { name: /^checkout$/i });
    expect(checkoutSticky).toHaveClass("min-h-12");
  });
});
