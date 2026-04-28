import type { Session, User } from "@supabase/supabase-js";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RequireAdmin from "./RequireAdmin";

const mockUseAuth = vi.fn();
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

function mockUser(overrides: Partial<User> & { app_metadata?: { role?: string } }): User {
  return {
    id: "u1",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
    ...overrides,
  } as User;
}

function renderGuard(initialPath = "/admin/products") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/admin/login"
          element={<div data-testid="admin-login-redirect-target">login</div>}
        />
        <Route element={<RequireAdmin />}>
          <Route path="/admin/products" element={<div data-testid="admin-outlet">products</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("RequireAdmin", () => {
  const noopAuth = {
    signIn: vi.fn(),
    signOut: vi.fn(),
  };

  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it("redirects to login when Supabase is not configured", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      loading: false,
      configured: false,
      ...noopAuth,
    });
    renderGuard();
    expect(screen.getByTestId("admin-login-redirect-target")).toBeInTheDocument();
  });

  it("shows loading when configured and session is loading", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      loading: true,
      configured: true,
      ...noopAuth,
    });
    renderGuard();
    expect(screen.getByTestId("admin-auth-loading")).toBeInTheDocument();
  });

  it("redirects to login when there is no user", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      loading: false,
      configured: true,
      ...noopAuth,
    });
    renderGuard();
    expect(screen.getByTestId("admin-login-redirect-target")).toBeInTheDocument();
  });

  it("shows forbidden UI for authenticated non-admin", () => {
    mockUseAuth.mockReturnValue({
      user: mockUser({ app_metadata: { role: "customer" } }),
      session: {} as Session,
      loading: false,
      configured: true,
      ...noopAuth,
    });
    renderGuard();
    expect(screen.getByTestId("admin-forbidden")).toBeInTheDocument();
  });

  it("renders child routes for admin", () => {
    mockUseAuth.mockReturnValue({
      user: mockUser({ app_metadata: { role: "admin" } }),
      session: {} as Session,
      loading: false,
      configured: true,
      ...noopAuth,
    });
    renderGuard();
    expect(screen.getByTestId("admin-outlet")).toBeInTheDocument();
  });
});
