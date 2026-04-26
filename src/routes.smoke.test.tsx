import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "./auth/AuthContext";
import { AppRoutes } from "./components/App/App";
import { CartProvider } from "./context/CartContext";

/**
 * Known-good slug from bundled static catalog (`data/products.json`).
 * Keep in sync with catalog seed; Epic 2+ may move to fixtures.
 */
const SMOKE_PRODUCT_SLUG = "boxer-briefs";

function renderRoute(initialPath: string) {
  return render(
    <CartProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    </CartProvider>
  );
}

describe("storefront route smoke (App.tsx router tree)", () => {
  it("admin login route mounts without storefront layout", async () => {
    renderRoute("/admin/login");
    expect(await screen.findByRole("heading", { name: /admin sign in/i })).toBeInTheDocument();
    expect(screen.queryByTestId("storefront-layout")).not.toBeInTheDocument();
  });

  it("unauthenticated /admin/products shows sign-in experience (AC1)", async () => {
    renderRoute("/admin/products");
    expect(await screen.findByRole("heading", { name: /admin sign in/i })).toBeInTheDocument();
  });

  it("product detail with bogus slug shows not-found (adapter-backed)", async () => {
    renderRoute("/product/__no_such_slug_zlx__");
    expect(await screen.findByTestId("storefront-layout")).toBeInTheDocument();
    expect(await screen.findByTestId("product-detail-not-found")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /product not found/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to products/i })).toHaveAttribute(
      "href",
      "/products"
    );
  });

  const cases: [string, RegExp][] = [
    ["/", /Product List/i],
    ["/products", /Product List/i],
    ["/women", /Empower Your Style/i],
    ["/men", /For the Modern Man/i],
    ["/kids", /Fun & Functional/i],
    ["/sale", /Limited Time Offers/i],
    ["/cart", /SHOPPING/i],
    ["/checkout", /^Checkout$/i],
    ["/order-confirmation", /Order Confirmed/i],
    [`/product/${SMOKE_PRODUCT_SLUG}`, /Zephyr Lux Boxer Briefs/i],
  ];

  it.each(cases)("mounts %s without uncaught render failure", async (path, textMatcher) => {
    renderRoute(path);
    expect(await screen.findByTestId("storefront-layout")).toBeInTheDocument();
    expect(await screen.findByText(textMatcher)).toBeInTheDocument();
    if (path.startsWith("/product/")) {
      expect(await screen.findByTestId("pdp")).toBeInTheDocument();
      expect(await screen.findByTestId("pdp-variant-selector")).toBeInTheDocument();
    }
  });
});
