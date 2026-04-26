import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { CartProvider } from "../../context/CartContext";
import ProductDetail from "./ProductDetail";

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
  it("updates price and stock when size and color are selected", async () => {
    renderPdp();
    expect(await screen.findByTestId("pdp-variant-selector")).toBeInTheDocument();

    const sizeSelect = screen.getByTestId("pdp-select-size");
    fireEvent.change(sizeSelect, { target: { value: "L" } });

    const colorSelect = screen.getByTestId("pdp-select-color");
    await waitFor(() => {
      expect(colorSelect).not.toBeDisabled();
    });
    fireEvent.change(colorSelect, { target: { value: "black" } });

    const price = await screen.findByTestId("pdp-selected-price");
    expect(price).toHaveTextContent("$24.00");
    const stock = screen.getByTestId("pdp-stock-message");
    expect(stock.textContent).toMatch(/3|Only 3|left/);
  });

  it("leaves add-to-cart disabled until both dimensions are chosen", async () => {
    renderPdp();
    await screen.findByTestId("pdp-variant-selector");
    const btn = screen.getByTestId("pdp-add-to-cart");
    expect(btn).toBeDisabled();
    fireEvent.change(screen.getByTestId("pdp-select-size"), {
      target: { value: "M" },
    });
    expect(btn).toBeDisabled();
  });
});
