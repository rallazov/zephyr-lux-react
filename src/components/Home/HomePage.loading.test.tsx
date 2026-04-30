import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultCatalogAdapter } from "../../catalog/factory";
import HomePage from "./HomePage";

vi.mock("../../catalog/factory", () => ({
  getDefaultCatalogAdapter: vi.fn(),
}));

describe("HomePage loading placeholders", () => {
  beforeEach(() => {
    vi.mocked(getDefaultCatalogAdapter).mockReset();
  });

  it("shows catalog loading hero copy and busy collection section until adapter resolves", async () => {
    vi.mocked(getDefaultCatalogAdapter).mockReturnValue({
      listProducts: async () => {
        await new Promise((r) => setTimeout(r, 80));
        return [];
      },
      listProductsByCategory: async () => [],
      getProductBySlug: async () => null,
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <HomePage />
      </MemoryRouter>
    );

    expect(screen.getByText(/loading the catalog/i)).toBeInTheDocument();

    const preparing = screen.getByText(/preparing links/i);
    const busyShell = preparing.closest("section");
    expect(busyShell).toHaveAttribute("aria-busy", "true");
    expect(busyShell).toHaveAttribute("aria-live", "polite");

    // Do not match the loading-state h2 — wait for collection chips (not the hero CTA label "Shop Women").
    expect(await screen.findByRole("link", { name: /^women$/i })).toBeInTheDocument();
    expect(screen.queryByText(/preparing links/i)).not.toBeInTheDocument();
  });
});
