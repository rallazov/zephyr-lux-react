import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { COLLECTION_ROUTES } from "../../catalog/collections";
import { getDefaultCatalogAdapter } from "../../catalog/factory";
import CollectionPage from "./CollectionPage";

vi.mock("../../catalog/factory", () => ({
  getDefaultCatalogAdapter: vi.fn(),
}));

describe("CollectionPage loading placeholders", () => {
  beforeEach(() => {
    vi.mocked(getDefaultCatalogAdapter).mockReset();
  });

  it("shows inline loading copy until category query resolves", async () => {
    const collection = COLLECTION_ROUTES.find((c) => c.path === "/women")!;

    vi.mocked(getDefaultCatalogAdapter).mockReturnValue({
      listProducts: async () => [],
      listProductsByCategory: async () => {
        await new Promise((r) => setTimeout(r, 80));
        return [];
      },
      getProductBySlug: async () => null,
    });

    render(
      <MemoryRouter initialEntries={[collection.path]}>
        <CollectionPage collection={collection} />
      </MemoryRouter>
    );

    const listBlock = screen.getByRole("heading", { level: 2, name: /^women$/i }).parentElement!;
    expect(within(listBlock).getByText(/^loading/i)).toBeInTheDocument();

    expect(
      await within(listBlock).findByText(/nothing in this collection yet/i)
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(within(listBlock).queryByText(/^loading/i)).not.toBeInTheDocument();
    });
  });
});
