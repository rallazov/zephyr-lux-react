import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import type { CatalogAdapter } from "../../catalog/adapter";
import { PRODUCT_WAITLIST_ACK_MESSAGE } from "../../lib/productWaitlistAck";
import { CartProvider } from "../../context/CartContext";
import ProductDetail from "./ProductDetail";

const fetchMock = vi.fn();

vi.mock("../../catalog/factory", () => ({
  getDefaultCatalogAdapter: (): CatalogAdapter => ({
    listProducts: async () => [],
    listProductsByCategory: async () => [],
    getProductBySlug: async () => ({
      storefrontProductId: 105,
      product: {
        id: "a0000005-0000-4000-8000-000000000005",
        slug: "seasonal-archive-sale",
        title: "Seasonal Archive",
        status: "coming_soon",
        variants: [
          {
            sku: "ZLX-SALE-ARCHIVE-PLACEHOLDER",
            size: "OS",
            color: undefined,
            price_cents: 4500,
            currency: "USD",
            inventory_quantity: 0,
            status: "inactive",
            image_url: "/assets/img/sale_placeholder.jpeg",
          },
        ],
      },
      galleryImages: [],
      displayGalleryUrls: ["/assets/img/sale_placeholder.jpeg"],
      variantPrimaryImageBySku: {},
      subscriptionPlans: [],
    }),
  }),
}));

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal(
    "fetch",
    fetchMock as unknown as typeof fetch,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderWaitlistPdp() {
  return render(
    <CartProvider>
      <MemoryRouter initialEntries={["/product/seasonal-archive-sale"]}>
        <Routes>
          <Route path="/product/:slug" element={<ProductDetail />} />
        </Routes>
      </MemoryRouter>
    </CartProvider>,
  );
}

describe("ProductDetail coming_soon waitlist", () => {
  it("submits email and shows acknowledgement on 202", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({ message: PRODUCT_WAITLIST_ACK_MESSAGE }),
    });

    renderWaitlistPdp();

    expect(await screen.findByTestId("pdp-waitlist")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "waiter@example.com" },
    });
    fireEvent.click(screen.getByTestId("pdp-waitlist-submit"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/product-waitlist",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "waiter@example.com",
            product_id: "a0000005-0000-4000-8000-000000000005",
          }),
        }),
      );
    });

    expect(await screen.findByText(PRODUCT_WAITLIST_ACK_MESSAGE)).toBeInTheDocument();
  });
});
