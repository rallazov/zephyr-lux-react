import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogAdapter } from "../../catalog/adapter";
import { CartProvider } from "../../context/CartContext";
import ProductDetail from "./ProductDetail";

vi.mock("../../catalog/factory", () => ({
  getDefaultCatalogAdapter: (): CatalogAdapter => ({
    listProducts: async () => [],
    listProductsByCategory: async () => [],
    getProductBySlug: async () => ({
      storefrontProductId: 99,
      product: {
        slug: "mock-pdp-gallery",
        title: "Mock Gallery Product",
        status: "active",
        variants: [
          {
            sku: "SKU-S",
            size: "S",
            color: "black",
            price_cents: 1000,
            currency: "usd",
            inventory_quantity: 5,
            status: "active",
            image_url: "/legacy-s.jpg",
          },
          {
            sku: "SKU-M",
            size: "M",
            color: "black",
            price_cents: 1000,
            currency: "usd",
            inventory_quantity: 5,
            status: "active",
            image_url: "/legacy-m.jpg",
          },
        ],
      },
      galleryImages: [],
      displayGalleryUrls: ["/legacy-s.jpg", "/legacy-m.jpg", "/primary-s.jpg", "/primary-m.jpg"],
      variantPrimaryImageBySku: {
        "SKU-S": "/primary-s.jpg",
        "SKU-M": "/primary-m.jpg",
      },
    }),
  }),
}));

beforeEach(() => {
  localStorage.clear();
});

function renderGalleryPdp() {
  return render(
    <CartProvider>
      <MemoryRouter initialEntries={["/product/mock-pdp-gallery"]}>
        <Routes>
          <Route path="/product/:slug" element={<ProductDetail />} />
        </Routes>
      </MemoryRouter>
    </CartProvider>
  );
}

describe("ProductDetail gallery / hero parity", () => {
  it("updates main image when variant selection changes (primary map)", async () => {
    renderGalleryPdp();
    expect(await screen.findByTestId("pdp-image-gallery")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("pdp-select-size"), {
      target: { value: "S" },
    });

    await waitFor(() => {
      expect(screen.getByTestId("pdp-gallery-main")).toHaveAttribute("src", "/primary-s.jpg");
    });

    fireEvent.change(screen.getByTestId("pdp-select-size"), {
      target: { value: "M" },
    });

    await waitFor(() => {
      expect(screen.getByTestId("pdp-gallery-main")).toHaveAttribute("src", "/primary-m.jpg");
    });
  });
});
