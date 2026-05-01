import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { CartProvider } from "../../context/CartContext";
import ProductDetail from "./ProductDetail";

beforeEach(() => {
  localStorage.clear();
});

function renderPdp() {
  return render(
    <CartProvider>
      <MemoryRouter initialEntries={["/product/boxer-briefs"]}>
        <Routes>
          <Route path="/product/:slug" element={<ProductDetail />} />
        </Routes>
      </MemoryRouter>
    </CartProvider>
  );
}

describe("ProductDetail variant selection", () => {
  it("shows pack copy and size-only controls for boxer-briefs (no color selector)", async () => {
    renderPdp();
    expect(await screen.findByTestId("pdp-variant-selector")).toBeInTheDocument();
    expect(screen.getByTestId("pdp-product-subtitle")).toHaveTextContent(/2-piece pack/i);
    expect(screen.getByTestId("pdp-product-subtitle")).toHaveTextContent(/black/i);
    expect(screen.getByTestId("pdp-product-subtitle")).toHaveTextContent(/blue/i);
    expect(screen.queryByTestId("pdp-select-color")).not.toBeInTheDocument();
  });

  it("updates price and low-stock message when size is selected", async () => {
    renderPdp();
    expect(await screen.findByTestId("pdp-variant-selector")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("pdp-select-size"), { target: { value: "L" } });

    const price = await screen.findByTestId("pdp-selected-price");
    await waitFor(() => {
      expect(price).toHaveTextContent("$24.00");
    });
    const stock = screen.getByTestId("pdp-stock-message");
    expect(stock.textContent).toMatch(/3|Only 3|left/);
  });

  it("enables add-to-cart after size is chosen (single dimension)", async () => {
    renderPdp();
    await screen.findByTestId("pdp-variant-selector");
    const btn = screen.getByTestId("pdp-add-to-cart");
    expect(btn).toBeDisabled();
    fireEvent.change(screen.getByTestId("pdp-select-size"), {
      target: { value: "M" },
    });
    await waitFor(() => {
      expect(btn).not.toBeDisabled();
    });
  });
});
