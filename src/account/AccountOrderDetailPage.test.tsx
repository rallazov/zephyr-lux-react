import type { Session, User } from "@supabase/supabase-js";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AccountOrderDetailPage from "./AccountOrderDetailPage";

const mockUseAuth = vi.fn();

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../lib/apiBase", () => ({
  apiUrl: (path: string) => path,
}));

function mockUser(overrides: Partial<User> = {}): User {
  return {
    id: "customer-1",
    aud: "authenticated",
    role: "authenticated",
    email: "shopper@example.com",
    app_metadata: {},
    user_metadata: {},
    ...overrides,
  } as User;
}

function authValue(overrides: Record<string, unknown> = {}) {
  return {
    user: null,
    session: null,
    loading: false,
    configured: true,
    signIn: vi.fn(),
    signOut: vi.fn(),
    customerSignInWithEmailOtp: vi.fn(),
    verifyCustomerEmailOtp: vi.fn(),
    ...overrides,
  };
}

const validOrderId = "11111111-1111-4111-8111-111111111111";

function renderDetail(orderId: string) {
  return render(
    <MemoryRouter initialEntries={[`/account/orders/${orderId}`]}>
      <Routes>
        <Route path="/account/orders/:orderId" element={<AccountOrderDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AccountOrderDetailPage", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("fetch must be mocked per test")),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows bad-id when route param is not a strict UUID", () => {
    mockUseAuth.mockReturnValue(authValue({ loading: false, configured: true }));

    renderDetail("not-a-uuid");

    expect(screen.getByRole("heading", { name: /order not available/i })).toBeInTheDocument();
  });

  it("shows missing-config when auth is not configured", () => {
    mockUseAuth.mockReturnValue(authValue({ configured: false }));

    renderDetail(validOrderId);

    expect(screen.getByText(/supabase is not configured/i)).toBeInTheDocument();
  });

  it("shows needs-auth when signed out", () => {
    mockUseAuth.mockReturnValue(
      authValue({
        user: null,
        session: null,
        loading: false,
        configured: true,
      }),
    );

    renderDetail(validOrderId);

    expect(screen.getByRole("heading", { name: /^sign in required$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to account/i })).toHaveAttribute(
      "href",
      "/account",
    );
  });

  it("shows needs-auth after API responds 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: "nope" }),
      }),
    );

    mockUseAuth.mockReturnValue(
      authValue({
        user: mockUser(),
        session: { access_token: "dead-token", refresh_token: "r", expires_in: 1, token_type: "bearer" } as Session,
        configured: true,
      }),
    );

    renderDetail(validOrderId);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^sign in required$/i })).toBeInTheDocument();
    });
  });

  it("shows not-found for 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: "gone" }),
      }),
    );

    mockUseAuth.mockReturnValue(
      authValue({
        user: mockUser(),
        session: { access_token: "live-token", refresh_token: "r", expires_in: 1, token_type: "bearer" } as Session,
        configured: true,
      }),
    );

    renderDetail(validOrderId);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /order not available/i })).toBeInTheDocument();
      expect(screen.getByText(/guest lookup instead/i)).toBeInTheDocument();
    });
  });

  it("shows error when payload does not satisfy wire validation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          broken: true,
        }),
      }),
    );

    mockUseAuth.mockReturnValue(
      authValue({
        user: mockUser(),
        session: { access_token: "live-token", refresh_token: "r", expires_in: 1, token_type: "bearer" } as Session,
        configured: true,
      }),
    );

    renderDetail(validOrderId);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /something went wrong/i })).toBeInTheDocument();
    });
  });

  it("renders order status chrome when payload is legal", async () => {
    const payload = {
      order_number: "ZLX-88",
      created_at: "2026-03-03T01:02:03.000Z",
      payment_status: "paid",
      fulfillment_status: "processing",
      total_cents: 1500,
      currency: "USD",
      customer_email_masked: null,
      items: [
        {
          product_title: "Boxers",
          variant_title: null,
          sku: "SKU-123",
          quantity: 1,
          unit_price_cents: 1500,
          total_cents: 1500,
          image_url: null,
        },
      ],
      timeline: [],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => payload,
      }),
    );

    mockUseAuth.mockReturnValue(
      authValue({
        user: mockUser(),
        session: { access_token: "live-token", refresh_token: "r", expires_in: 1, token_type: "bearer" } as Session,
        configured: true,
      }),
    );

    renderDetail(validOrderId);

    await waitFor(
      () => {
        expect(screen.queryByTestId("account-order-detail-loading")).not.toBeInTheDocument();
      },
      { timeout: 8000 },
    );

    expect(screen.getByRole("heading", { name: /^order status$/i })).toBeInTheDocument();
    expect(screen.getByText(/Order ZLX-88/i)).toBeInTheDocument();
  });
});
