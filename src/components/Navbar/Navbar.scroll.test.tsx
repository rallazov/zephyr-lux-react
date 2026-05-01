import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CART_LOCAL_STORAGE_KEY } from "../../cart/storage";
import { CartProvider } from "../../context/CartContext";
import Navbar from "./Navbar";

function setWindowScrollY(y: number) {
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    value: y,
    writable: true,
  });
}

function renderNav() {
  return render(
    <CartProvider>
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    </CartProvider>
  );
}

describe("Navbar scroll & mobile drawer behavior", () => {
  beforeEach(() => {
    localStorage.removeItem(CART_LOCAL_STORAGE_KEY);
    setWindowScrollY(0);
  });

  afterEach(() => {
    setWindowScrollY(0);
    localStorage.removeItem(CART_LOCAL_STORAGE_KEY);
  });

  it("adds scrolled styling class when scroll position passes the threshold", () => {
    renderNav();
    const nav = screen.getByRole("navigation");
    expect(nav).not.toHaveClass("scrolled");

    setWindowScrollY(101);
    fireEvent.scroll(window);
    expect(nav).toHaveClass("scrolled");

    setWindowScrollY(40);
    fireEvent.scroll(window);
    expect(nav).not.toHaveClass("scrolled");
  });

  it("opens the hamburger drawer so primary links are mounted for small-viewport layouts", async () => {
    const user = userEvent.setup();
    renderNav();

    await user.click(screen.getByRole("button", { name: /toggle navigation menu/i }));
    const list = screen.getByRole("list", { hidden: true });
    expect(list).toHaveClass("open");
    expect(within(list).getByRole("link", { name: /^shop$/i })).toHaveAttribute("href", "/products");
    expect(within(list).getByRole("link", { name: /^women$/i })).toHaveAttribute("href", "/women");
    expect(within(list).getByRole("link", { name: /^search$/i })).toHaveAttribute("href", "/search");
  });

  it("closes the mobile menu after window scroll (integrated listener)", async () => {
    const user = userEvent.setup();
    renderNav();

    await user.click(screen.getByRole("button", { name: /toggle navigation menu/i }));
    const list = screen.getByRole("list", { hidden: true });
    expect(list).toHaveClass("open");

    setWindowScrollY(20);
    fireEvent.scroll(window);
    expect(list).not.toHaveClass("open");
  });

  it("closes the mobile menu after wheel interaction while menu is open", async () => {
    const user = userEvent.setup();
    renderNav();

    await user.click(screen.getByRole("button", { name: /toggle navigation menu/i }));
    const list = screen.getByRole("list", { hidden: true });
    expect(list).toHaveClass("open");

    fireEvent.wheel(window);
    expect(list).not.toHaveClass("open");
  });

  it("cart link stays a real navigation target (pointer path; CSS hover is browser-only)", async () => {
    const user = userEvent.setup();
    renderNav();

    const cart = screen.getByRole("link", { name: /^cart$/i });
    expect(cart).toHaveAttribute("href", "/cart");
    await user.hover(cart);
    expect(cart).toHaveAttribute("href", "/cart");
  });

  it("collection nav links accept hover without breaking href", async () => {
    const user = userEvent.setup();
    renderNav();

    const shopWomen = screen.getByRole("link", { name: /^women$/i });
    expect(shopWomen).toHaveAttribute("href", "/women");
    await user.hover(shopWomen);
    expect(shopWomen).toHaveAttribute("href", "/women");
  });

  it("order lookup icon links to order status (honest account affordance)", () => {
    renderNav();
    const orderLookup = screen.getByRole("link", { name: /order lookup/i });
    expect(orderLookup).toHaveAttribute("href", "/order-status");
  });

});
