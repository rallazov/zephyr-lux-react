import type { Session, User } from "@supabase/supabase-js";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AccountPage from "./AccountPage";

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
    customerSignInWithEmailOtp: vi.fn().mockResolvedValue({ error: null }),
    verifyCustomerEmailOtp: vi.fn(),
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/account"]}>
      <AccountPage />
    </MemoryRouter>,
  );
}

describe("AccountPage", () => {
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

  it("shows a restrained unavailable state when Supabase auth is not configured", () => {
    mockUseAuth.mockReturnValue(authValue({ configured: false }));

    renderPage();

    expect(screen.getByTestId("account-page")).toBeInTheDocument();
    expect(
      screen.getByText(/sign-in is not available in this environment/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /^email$/i })).not.toBeInTheDocument();
  });

  it("shows auth loading skeleton", () => {
    mockUseAuth.mockReturnValue(authValue({ loading: true }));

    renderPage();

    expect(screen.getByTestId("account-auth-loading")).toBeInTheDocument();
  });

  it("shows order-history loading skeleton while awaiting history fetch", async () => {
    let release!: (r: Response) => void;
    const gate = new Promise<Response>((resolve) => {
      release = resolve;
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => gate),
    );

    mockUseAuth.mockReturnValue(
      authValue({
        user: mockUser(),
        session: {
          access_token: "blocking-token",
          refresh_token: "r",
          expires_in: 3600,
          token_type: "bearer",
        } as Session,
      }),
    );

    renderPage();

    expect(await screen.findByTestId("account-history-loading")).toBeInTheDocument();

    release({
      ok: true,
      status: 200,
      json: async () => ({ orders: [] }),
    } as Response);

    await waitFor(() => {
      expect(screen.getByTestId("account-history-empty")).toBeInTheDocument();
    });
  });

  it("renders a passwordless signed-out form with validation and success state", async () => {
    const u = userEvent.setup();
    const customerSignInWithEmailOtp = vi.fn().mockResolvedValue({ error: null });
    mockUseAuth.mockReturnValue(authValue({ customerSignInWithEmailOtp }));

    renderPage();

    expect(screen.getByRole("heading", { name: /sign in without a password/i })).toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: /email me a sign-in link/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/valid email/i);
    expect(customerSignInWithEmailOtp).not.toHaveBeenCalled();

    await u.type(screen.getByRole("textbox", { name: /^email$/i }), "shopper@example.com");
    await u.click(screen.getByRole("button", { name: /email me a sign-in link/i }));

    expect(customerSignInWithEmailOtp).toHaveBeenCalledWith("shopper@example.com", {
      emailRedirectTo: expect.stringMatching(/\/account$/),
    });
    expect(await screen.findByRole("status")).toHaveTextContent(/check your email/i);
  });

  it("announces provider failures without exposing provider internals", async () => {
    const u = userEvent.setup();
    const customerSignInWithEmailOtp = vi.fn().mockResolvedValue({
      error: new Error("supabase auth 500 details"),
    });
    mockUseAuth.mockReturnValue(authValue({ customerSignInWithEmailOtp }));

    renderPage();

    await u.type(screen.getByRole("textbox", { name: /^email$/i }), "shopper@example.com");
    await u.click(screen.getByRole("button", { name: /email me a sign-in link/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/could not send a sign-in link/i);
    expect(alert).not.toHaveTextContent(/supabase auth 500/i);
  });

  it("renders signed-in profile, invokes sign-out, and shows populated order history", async () => {
    const u = userEvent.setup();
    const signOut = vi.fn().mockResolvedValue(undefined);
    const ordersPayload = [
      {
        order_id: "11111111-1111-4111-8111-111111111111",
        order_number: "ZLX-1001",
        created_at: "2026-01-15T12:00:00.000Z",
        payment_status: "paid",
        fulfillment_status: "processing",
        total_cents: 12999,
        currency: "USD",
        item_count: 2,
      },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ orders: ordersPayload }),
      }),
    );

    mockUseAuth.mockReturnValue(
      authValue({
        user: mockUser(),
        session: {
          access_token: "access-token-unit-test",
          refresh_token: "r",
          expires_in: 3600,
          token_type: "bearer",
        } as Session,
        signOut,
      }),
    );

    renderPage();

    expect(screen.getByTestId("account-profile-email")).toHaveTextContent("shopper@example.com");
    expect(await screen.findByTestId("account-history-list")).toBeInTheDocument();
    expect(screen.getByText("ZLX-1001")).toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: /sign out/i }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("renders signed-in empty order history with guest lookup affordance", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ orders: [] }),
      }),
    );

    mockUseAuth.mockReturnValue(
      authValue({
        user: mockUser(),
        session: { access_token: "t" } as Session,
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("account-history-empty")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /look up an order/i })).toHaveAttribute(
      "href",
      "/order-status",
    );
  });

  it("surfaces order history API failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: "upstream issue" }),
      }),
    );

    mockUseAuth.mockReturnValue(
      authValue({
        user: mockUser(),
        session: { access_token: "t" } as Session,
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("account-history-error")).toHaveTextContent(/upstream issue/i);
    });
  });
});
