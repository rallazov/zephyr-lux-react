import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AdminLayout from "./AdminLayout";

const mockUseAuth = vi.fn();
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("AdminLayout (mobile-friendly chrome)", () => {
  it("uses a horizontally scrollable nav and ~44px tap targets on admin links", () => {
    mockUseAuth.mockReturnValue({
      signOut: vi.fn(),
      customerSignInWithEmailOtp: vi.fn(),
      verifyCustomerEmailOtp: vi.fn(),
      user: { email: "owner@example.com" },
      configured: true,
    });

    render(
      <MemoryRouter initialEntries={["/admin/orders"]}>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route path="/admin/orders" element={<div>orders outlet</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation", { name: /admin/i });
    expect(nav).toHaveClass("overflow-x-auto");

    const ordersLink = screen.getByRole("link", { name: "Orders" });
    expect(ordersLink).toHaveClass("min-h-11");
  });
});
