import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultCatalogAdapter } from "../../catalog/factory";
import { parseStaticCatalogData } from "../../catalog/parse";
import { CartProvider } from "../../context/CartContext";
import SearchPage from "./SearchPage";

vi.mock("../../catalog/factory", () => ({
  getDefaultCatalogAdapter: vi.fn(),
}));

/** Test-only: mirrors MemoryRouter location.search for assertions (Data Router hits jsdom AbortSignal issues). */
function MemoryLocationProbe({ onSearch }: { onSearch: (search: string) => void }) {
  const { search } = useLocation();
  onSearch(search);
  return null;
}

function renderSearch(initialPath = "/search") {
  return render(
    <CartProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/search" element={<SearchPage />} />
        </Routes>
      </MemoryRouter>
    </CartProvider>
  );
}

function renderSearchWithLocationProbe(
  initialPath: string,
  locationRef: { current: string }
) {
  const capture = (search: string) => {
    locationRef.current = search;
  };
  return render(
    <CartProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <MemoryLocationProbe onSearch={capture} />
        <Routes>
          <Route path="/search" element={<SearchPage />} />
        </Routes>
      </MemoryRouter>
    </CartProvider>
  );
}

const alphaRow = parseStaticCatalogData([
  {
    id: 1,
    slug: "alpha-slip",
    title: "Alpha Slip Dress",
    category: "women",
    status: "active",
    variants: [
      {
        sku: "A1",
        price_cents: 1000,
        currency: "USD",
        inventory_quantity: 1,
        status: "active",
      },
    ],
  },
]).listItems;

const mixedRows = parseStaticCatalogData([
  {
    id: 1,
    slug: "alpha-slip",
    title: "Alpha Slip Dress",
    category: "women",
    status: "active",
    variants: [
      {
        sku: "A1",
        price_cents: 1000,
        currency: "USD",
        inventory_quantity: 1,
        status: "active",
      },
    ],
  },
  {
    id: 2,
    slug: "basic-tee",
    title: "Basic Tee",
    status: "active",
    variants: [
      {
        sku: "B1",
        price_cents: 900,
        currency: "USD",
        inventory_quantity: 2,
        status: "active",
      },
    ],
  },
]).listItems;

describe("SearchPage", () => {
  beforeEach(() => {
    vi.mocked(getDefaultCatalogAdapter).mockReset();
  });

  it("deep-linked q shows matches without submitting the form", async () => {
    vi.mocked(getDefaultCatalogAdapter).mockReturnValue({
      listProducts: async () => mixedRows,
      listProductsByCategory: async () => [],
      getProductBySlug: async () => null,
    });

    renderSearch("/search?q=slip");
    expect(await screen.findByText(/alpha slip dress/i)).toBeInTheDocument();
    expect(screen.queryByText(/basic tee/i)).not.toBeInTheDocument();
  });

  it("happy path shows matches for submitted query", async () => {
    const user = userEvent.setup();
    vi.mocked(getDefaultCatalogAdapter).mockReturnValue({
      listProducts: async () => mixedRows,
      listProductsByCategory: async () => [],
      getProductBySlug: async () => null,
    });

    renderSearch("/search");
    expect(await screen.findByRole("heading", { name: /^search$/i })).toBeInTheDocument();
    const box = screen.getByRole("searchbox");
    await user.clear(box);
    await user.type(box, "slip");
    await user.click(screen.getByRole("button", { name: /^search$/i }));

    expect(await screen.findByText(/alpha slip dress/i)).toBeInTheDocument();
    expect(screen.queryByText(/basic tee/i)).not.toBeInTheDocument();
  });

  it("shows designed empty state when nothing matches", async () => {
    vi.mocked(getDefaultCatalogAdapter).mockReturnValue({
      listProducts: async () => alphaRow,
      listProductsByCategory: async () => [],
      getProductBySlug: async () => null,
    });

    renderSearch("/search?q=zzz");
    expect(await screen.findByRole("heading", { name: /no matching products/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse all products/i })).toHaveAttribute(
      "href",
      "/products"
    );
    expect(screen.getByRole("link", { name: /return home/i })).toHaveAttribute("href", "/");
  });

  it("whitespace-only in URL shows guidance instead of empty-result heading", async () => {
    vi.mocked(getDefaultCatalogAdapter).mockReturnValue({
      listProducts: async () => mixedRows,
      listProductsByCategory: async () => [],
      getProductBySlug: async () => null,
    });

    renderSearch("/search?q=+++");
    expect(await screen.findByRole("status")).toHaveTextContent(/spaces alone/i);
    expect(screen.queryByRole("heading", { name: /no matching products/i })).not.toBeInTheDocument();
  });

  it("does not fake no-matches without submit: avoids empty-results on idle /search", async () => {
    vi.mocked(getDefaultCatalogAdapter).mockReturnValue({
      listProducts: async () => mixedRows,
      listProductsByCategory: async () => [],
      getProductBySlug: async () => null,
    });

    renderSearch("/search");
    await screen.findByRole("heading", { name: /^search$/i });
    expect(screen.queryByRole("heading", { name: /no matching products/i })).not.toBeInTheDocument();
    const submit = screen.getByRole("button", { name: /^search$/i });
    expect(submit).toBeDisabled();
  });

  it("Submit button stays disabled until input has non-whitespace characters", async () => {
    const user = userEvent.setup();
    vi.mocked(getDefaultCatalogAdapter).mockReturnValue({
      listProducts: async () => mixedRows,
      listProductsByCategory: async () => [],
      getProductBySlug: async () => null,
    });

    renderSearch("/search");
    await screen.findByRole("heading", { name: /^search$/i });
    const submit = screen.getByRole("button", { name: /^search$/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByRole("searchbox"), "   ");
    expect(submit).toBeDisabled();
  });

  it("Escape clears the search field and removes q from the URL", async () => {
    const user = userEvent.setup();
    vi.mocked(getDefaultCatalogAdapter).mockReturnValue({
      listProducts: async () => mixedRows,
      listProductsByCategory: async () => [],
      getProductBySlug: async () => null,
    });

    const locationRef = { current: "__uninitialized__" };
    renderSearchWithLocationProbe("/search?q=slip", locationRef);
    await waitFor(() => {
      expect(locationRef.current).toBe("?q=slip");
    });

    const box = await screen.findByRole("searchbox");
    expect(box).toHaveValue("slip");
    await user.click(box);
    await user.keyboard("{Escape}");
    expect(box).toHaveValue("");
    await waitFor(() => {
      expect(locationRef.current).toBe("");
    });
  });
});
