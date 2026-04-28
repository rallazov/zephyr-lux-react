import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CustomerOrderStatusPage from "./CustomerOrderStatusPage";
import type { CustomerOrderStatusResponse } from "./customerOrderStatusViewModel";

const token = "a".repeat(43);

function renderStatusPage(path = `/order-status/${token}`) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/order-status/:token" element={<CustomerOrderStatusPage />} />
        <Route path="/order-status" element={<CustomerOrderStatusPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function validResponse(overrides: Partial<CustomerOrderStatusResponse> = {}): CustomerOrderStatusResponse {
  return {
    order_number: "ZLX-20260428-0007",
    created_at: "2026-04-28T10:00:00Z",
    payment_status: "paid",
    fulfillment_status: "shipped",
    total_cents: 6400,
    currency: "usd",
    customer_email_masked: "bu***@example.com",
    items: [
      {
        product_title: "Boxer Briefs",
        variant_title: "Black / M",
        sku: "ZLX-BLK-M",
        quantity: 2,
        unit_price_cents: 3200,
        total_cents: 6400,
        image_url: null,
      },
    ],
    timeline: [
      {
        event_type: "fulfillment_status_changed",
        created_at: "2026-04-28T11:00:00Z",
        from: "packed",
        to: "shipped",
      },
    ],
    ...overrides,
  };
}

describe("CustomerOrderStatusPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a loading state while resolving the token", async () => {
    const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);

    renderStatusPage();

    expect(await screen.findByRole("status")).toHaveTextContent(/loading your order status/i);
    expect(fetchMock).toHaveBeenCalledWith(`/api/customer-order-status?token=${token}`);
  });

  it("shows a generic invalid or expired state when access fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn(),
      }),
    );

    renderStatusPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(/expired or invalid/i);
    expect(screen.getByRole("link", { name: /request a new link/i })).toHaveAttribute(
      "href",
      "/order-status",
    );
  });

  it("renders a compact customer-safe order status page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(validResponse()),
      }),
    );

    renderStatusPage();

    expect(await screen.findByText("Order ZLX-20260428-0007")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Shipped" })).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(screen.getAllByText("$64.00").length).toBeGreaterThan(0);
    expect(screen.getByText("Boxer Briefs - Black / M")).toBeInTheDocument();
    expect(screen.getByText("SKU ZLX-BLK-M")).toBeInTheDocument();
    expect(screen.getByText("Packed to Shipped")).toBeInTheDocument();
    expect(screen.getByLabelText("Fulfillment progress")).toHaveTextContent(/Preparing/);
    expect(screen.getByText(/bu\*\*\*@example\.com/)).toBeInTheDocument();
  });

  it("does not render internal timeline events if one appears in the payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(
          validResponse({
            timeline: [
              {
                event_type: "internal_note",
                created_at: "2026-04-28T11:00:00Z",
              },
              {
                event_type: "fulfillment_status_changed",
                created_at: "2026-04-28T12:00:00Z",
                to: "packed",
              },
            ],
          }),
        ),
      }),
    );

    renderStatusPage();

    expect(await screen.findByText("Packed update")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Timeline" })).toBeInTheDocument();
  });

  it("does not call the API when no token is present", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderStatusPage("/order-status");

    expect(await screen.findByRole("alert")).toHaveTextContent(/expired or invalid/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows tracking details when the API includes shipment tracking", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(
          validResponse({
            tracking: {
              carrier: "UPS",
              tracking_number: "1ZX",
              tracking_url: "https://www.ups.com/track?tracknum=1ZX",
              status: "shipped",
              shipped_at: "2026-04-28T12:00:00Z",
              delivered_at: null,
            },
          }),
        ),
      }),
    );

    renderStatusPage();

    expect(await screen.findByRole("heading", { name: "Tracking" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open tracking page/i })).toHaveAttribute(
      "href",
      "https://www.ups.com/track?tracknum=1ZX",
    );
    expect(screen.getByText("UPS")).toBeInTheDocument();
  });

  it("shows tracking pending copy when shipment exists without carrier or number yet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(
          validResponse({
            tracking: {
              carrier: null,
              tracking_number: null,
              tracking_url: null,
              status: "shipped",
              shipped_at: null,
              delivered_at: null,
            },
          }),
        ),
      }),
    );

    renderStatusPage();

    expect(await screen.findByText(/tracking details are not available yet/i)).toBeInTheDocument();
  });
});
