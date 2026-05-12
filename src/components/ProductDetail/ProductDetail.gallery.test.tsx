import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
      collectionKeys: [],
      variantPrimaryImageBySku: {
        "SKU-S": "/primary-s.jpg",
        "SKU-M": "/primary-m.jpg",
      },
      subscriptionPlans: [],
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

async function selectSize(
  user: ReturnType<typeof userEvent.setup>,
  value: "S" | "M",
): Promise<void> {
  const select = screen.getByTestId("pdp-select-size") as HTMLSelectElement;
  // userEvent (preferred over fireEvent for React 18) wraps events in act() and yields
  // microtasks, which avoids a rare race where the controlled select didn't reflect the
  // new value after a synchronous fireEvent.change.
  await user.selectOptions(select, value);
  // Synchronize on the controlled select actually taking the value before we look at the
  // gallery. A timeout here surfaces the failure as "selection didn't stick" rather than
  // the more confusing "image didn't change to /primary-X.jpg" 10s downstream.
  await waitFor(() => {
    expect(
      (screen.getByTestId("pdp-select-size") as HTMLSelectElement).value,
    ).toBe(value);
  });
}

async function expectMainImageContains(fragment: string): Promise<void> {
  await waitFor(
    () => {
      const scope = screen.getByTestId("pdp-image-gallery");
      const main = within(scope).getByTestId("pdp-gallery-main");
      expect(main.getAttribute("src")).toContain(fragment);
    },
    { timeout: 10_000 },
  );
}

describe("ProductDetail gallery / hero parity", () => {
  it(
    "updates main image when variant selection changes (primary map)",
    { timeout: 25_000, retry: 2 },
    async () => {
      const user = userEvent.setup();
      renderGalleryPdp();
      expect(
        await screen.findByTestId("pdp-image-gallery", {}, { timeout: 10_000 }),
      ).toBeInTheDocument();

      await selectSize(user, "S");
      await expectMainImageContains("/primary-s.jpg");

      await selectSize(user, "M");
      await expectMainImageContains("/primary-m.jpg");
    },
  );
});
