import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuthProvider } from "./auth/AuthContext";
import { AppRoutes } from "./components/App/App";
import { CART_LOCAL_STORAGE_KEY } from "./cart/storage";
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
  beforeEach(() => {
    localStorage.removeItem(CART_LOCAL_STORAGE_KEY);
  });
  afterEach(() => {
    localStorage.removeItem(CART_LOCAL_STORAGE_KEY);
  });

  it("admin login route mounts without storefront layout", async () => {
    renderRoute("/admin/login");
    expect(await screen.findByRole("heading", { name: /admin sign in/i })).toBeInTheDocument();
    expect(screen.queryByTestId("storefront-layout")).not.toBeInTheDocument();
  });

  it("unauthenticated /admin/products shows sign-in experience (AC1)", async () => {
    renderRoute("/admin/products");
    expect(await screen.findByRole("heading", { name: /admin sign in/i })).toBeInTheDocument();
  });

  it("unauthenticated /admin/orders shows sign-in experience (5-2)", async () => {
    renderRoute("/admin/orders");
    expect(await screen.findByRole("heading", { name: /admin sign in/i })).toBeInTheDocument();
  });

  it("unauthenticated /admin/orders/:id shows sign-in experience", async () => {
    renderRoute("/admin/orders/00000000-0000-4000-8000-000000000001");
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
    ["/", /Premium essentials/i],
    ["/products", /Product List/i],
    ["/women", /Empower Your Style/i],
    ["/men", /For the Modern Man/i],
    ["/kids", /Fun & Functional/i],
    ["/sale", /Limited Time Offers/i],
    ["/underwear", /Foundation Essentials/i],
    ["/cart", /SHOPPING/i],
    ["/checkout", /^Checkout$/i],
    ["/order-confirmation", /Order confirmed|We couldn|processing your payment|Payment reference/i],
    [`/product/${SMOKE_PRODUCT_SLUG}`, /Zephyr Lux Boxer Briefs/i],
    ["/policies", /^Policies$/i],
    ["/policies/shipping", /^Shipping$/i],
    ["/policies/returns", /^Returns$/i],
    ["/policies/privacy", /^Privacy$/i],
    ["/policies/terms", /Terms of use/i],
    ["/contact", /Contact us/i],
  ];

  it("redirects unknown policy subpath to policy index", async () => {
    renderRoute("/policies/__no_such_policy__");
    expect(await screen.findByTestId("storefront-layout")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /^Policies$/i })).toBeInTheDocument();
  });

  it.each(cases)("mounts %s without uncaught render failure", async (path, textMatcher) => {
    localStorage.clear();
    if (path === "/checkout") {
      localStorage.setItem(
        "cartItems",
        JSON.stringify({
          v: 1,
          items: [
            {
              id: 101,
              name: "Zephyr Lux Boxer Briefs",
              quantity: 1,
              price: 24,
              image: "/assets/img/Listing2.jpeg",
              sku: "ZLX-BLK-M",
              product_slug: "boxer-briefs",
            },
          ],
        })
      );
    }
    renderRoute(path);
    expect(await screen.findByTestId("storefront-layout")).toBeInTheDocument();
    const headingOpts =
      path === "/checkout" ? { name: textMatcher, timeout: 15_000 } : { name: textMatcher };
    expect(await screen.findByRole("heading", headingOpts)).toBeInTheDocument();
    if (path.startsWith("/product/")) {
      expect(await screen.findByTestId("pdp")).toBeInTheDocument();
      expect(await screen.findByTestId("pdp-variant-selector")).toBeInTheDocument();
    }
  });
});
