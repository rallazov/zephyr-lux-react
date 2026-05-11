import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CART_LOCAL_STORAGE_KEY } from "../../cart/storage";
import { getDefaultCatalogAdapter } from "../../catalog/factory";
import { PDP_IMAGE_PLACEHOLDER } from "../../catalog/pdpImage";
import { parseStaticCatalogData } from "../../catalog/parse";
import { CartProvider } from "../../context/CartContext";
import OrderConfirmation from "./OrderConfirmation";

vi.mock("../../catalog/factory", () => ({
  getDefaultCatalogAdapter: vi.fn(),
}));

const catalogList = parseStaticCatalogData([
  {
    id: 7,
    slug: "boxer-briefs",
    title: "Boxer Briefs",
    status: "active",
    variants: [
      {
        sku: "ZLX-2PK-M",
        price_cents: 1899,
        currency: "USD",
        inventory_quantity: 10,
        status: "active",
      },
    ],
  },
]).listItems;

const row = catalogList[0];
const variant = row.product.variants.find((v) => v.sku === "ZLX-2PK-M")!;

function seedCart(): void {
  localStorage.setItem(
    CART_LOCAL_STORAGE_KEY,
    JSON.stringify({
      v: 1,
      items: [
        {
          id: row.storefrontProductId,
          name: row.product.title,
          quantity: 2,
          price: variant.price_cents / 100,
          image: row.heroImageUrl || PDP_IMAGE_PLACEHOLDER,
          sku: "ZLX-2PK-M",
          variant_id: variant.id,
          product_slug: row.product.slug,
        },
      ],
    }),
  );
}

function readPersistedCartItems(): unknown[] {
  const raw = localStorage.getItem(CART_LOCAL_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { items?: unknown[] };
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

function renderConfirmation(initialPath: string) {
  return render(
    <CartProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <OrderConfirmation />
      </MemoryRouter>
    </CartProvider>,
  );
}

describe("OrderConfirmation — cart reset on Stripe redirect", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.mocked(getDefaultCatalogAdapter).mockReset();
    vi.mocked(getDefaultCatalogAdapter).mockReturnValue({
      listProducts: async () => catalogList,
      listProductsByCategory: async () => [],
      getProductBySlug: async () => null,
    });
    // OrderConfirmation may fetch /api/order-by-payment-intent when it has a lookup hint;
    // the lookup hint sessionStorage key is intentionally absent in these tests, but stub
    // fetch defensively so unrelated network is never attempted.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("clears the cart after a successful Stripe redirect (redirect_status=succeeded)", async () => {
    seedCart();
    expect(readPersistedCartItems()).toHaveLength(1);

    renderConfirmation(
      "/order-confirmation?payment_intent=pi_test_succeeded&payment_intent_client_secret=pi_test_succeeded_secret_x&redirect_status=succeeded",
    );

    await waitFor(() => {
      expect(readPersistedCartItems()).toEqual([]);
    });

    expect(sessionStorage.getItem("zlx_cart_cleared_pi_test_succeeded")).toBe("1");
  });

  it("clears the cart when redirect_status=processing (intent committed, settlement pending)", async () => {
    seedCart();
    renderConfirmation(
      "/order-confirmation?payment_intent=pi_test_processing&redirect_status=processing",
    );

    await waitFor(() => {
      expect(readPersistedCartItems()).toEqual([]);
    });
  });

  it("does NOT clear the cart on a failed Stripe redirect (shopper retries from /cart)", async () => {
    seedCart();
    renderConfirmation(
      "/order-confirmation?payment_intent=pi_test_failed&redirect_status=failed",
    );

    // Allow CartProvider catalog hydration + any state churn to settle.
    await waitFor(() => {
      // CartProvider's catalog hydration may rewrite the same line back; what matters
      // is that the line still exists.
      expect(readPersistedCartItems()).toHaveLength(1);
    });

    expect(sessionStorage.getItem("zlx_cart_cleared_pi_test_failed")).toBeNull();
  });

  it("does NOT clear the cart on direct navigation to /order-confirmation (no Stripe params, fallback view)", async () => {
    seedCart();
    renderConfirmation("/order-confirmation");

    await waitFor(() => {
      expect(readPersistedCartItems()).toHaveLength(1);
    });
  });

  it("idempotent: re-rendering the same successful confirmation does not clobber a freshly seeded cart", async () => {
    seedCart();
    const { unmount } = renderConfirmation(
      "/order-confirmation?payment_intent=pi_test_idem&redirect_status=succeeded",
    );

    await waitFor(() => {
      expect(readPersistedCartItems()).toEqual([]);
    });

    unmount();

    // Shopper navigates back to PDP, adds a new item, then somehow lands on
    // the same confirmation URL again (browser back, deep link, etc.).
    seedCart();
    renderConfirmation(
      "/order-confirmation?payment_intent=pi_test_idem&redirect_status=succeeded",
    );

    // Allow effects to flush.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(readPersistedCartItems()).toHaveLength(1);
  });
});
