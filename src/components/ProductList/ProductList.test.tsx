import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultCatalogAdapter } from "../../catalog/factory";
import { parseStaticCatalogData } from "../../catalog/parse";
import { CartProvider } from "../../context/CartContext";
import ProductList from "./ProductList";

vi.mock("../../catalog/factory", () => ({
  getDefaultCatalogAdapter: vi.fn(),
}));

function renderList() {
  return render(
    <CartProvider>
      <MemoryRouter>
        <ProductList />
      </MemoryRouter>
    </CartProvider>
  );
}

const multiRow = parseStaticCatalogData([
  {
    id: 1,
    slug: "multi",
    title: "Multi Variant",
    fabric_type: "Cotton",
    status: "active",
    variants: [
      {
        sku: "M1",
        price_cents: 1000,
        currency: "USD",
        inventory_quantity: 1,
        status: "active",
      },
      {
        sku: "M2",
        price_cents: 1200,
        currency: "USD",
        inventory_quantity: 1,
        status: "active",
      },
    ],
  },
]).listItems;

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

describe("ProductList", () => {
  beforeEach(() => {
    vi.mocked(getDefaultCatalogAdapter).mockReset();
  });

  it("shows an empty state when the active catalog list is empty", async () => {
    vi.mocked(getDefaultCatalogAdapter).mockReturnValue({
      listProducts: async () => [],
      listProductsByCategory: async () => [],
      getProductBySlug: async () => null,
    });

    renderList();
    expect(
      await screen.findByText(/no products available right now/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /return home/i })).toHaveAttribute(
      "href",
      "/"
    );
  });

  it("does not show list add-to-cart when there are multiple purchasable variants", async () => {
    vi.mocked(getDefaultCatalogAdapter).mockReturnValue({
      listProducts: async () => multiRow,
      listProductsByCategory: async () => [],
      getProductBySlug: async () => null,
    });

    renderList();
    expect(await screen.findByText("Multi Variant")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add to cart/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /view details/i })
    ).toHaveAttribute("href", "/product/multi");
  });

  it("shows add-to-cart when there is exactly one purchasable variant", async () => {
    vi.mocked(getDefaultCatalogAdapter).mockReturnValue({
      listProducts: async () => singleRow,
      listProductsByCategory: async () => [],
      getProductBySlug: async () => null,
    });

    renderList();
    expect(await screen.findByText("Single Variant")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add to cart/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /view details/i })
    ).not.toBeInTheDocument();
  });

  it("add-to-cart stays actionable after hover (CSS hover states need a real browser)", async () => {
    const user = userEvent.setup();
    vi.mocked(getDefaultCatalogAdapter).mockReturnValue({
      listProducts: async () => singleRow,
      listProductsByCategory: async () => [],
      getProductBySlug: async () => null,
    });

    renderList();
    const cta = await screen.findByRole("button", { name: /add to cart/i });
    await user.hover(cta);
    expect(cta).toBeEnabled();
  });

  it("shows a loading state before the catalog resolves", async () => {
    vi.mocked(getDefaultCatalogAdapter).mockReturnValue({
      listProducts: async () => {
        await new Promise((r) => setTimeout(r, 60));
        return singleRow;
      },
      listProductsByCategory: async () => [],
      getProductBySlug: async () => null,
    });

    renderList();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(await screen.findByText("Single Variant")).toBeInTheDocument();
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });

  it("exposes load errors in an alert", async () => {
    vi.mocked(getDefaultCatalogAdapter).mockReturnValue({
      listProducts: async () => {
        throw new Error("catalog down");
      },
      listProductsByCategory: async () => [],
      getProductBySlug: async () => null,
    });

    renderList();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/could not load products/i);
  });
});
