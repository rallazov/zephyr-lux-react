import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OrderStatusLookup from "./OrderStatusLookup";
import { ORDER_LOOKUP_NEUTRAL_MESSAGE } from "./orderLookupRequest";

function mockFetch(response: Promise<Partial<Response>>) {
  const fetchMock = vi.fn().mockReturnValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("OrderStatusLookup", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows validation errors without submitting empty fields", async () => {
    const fetchMock = mockFetch(Promise.resolve({ ok: true }));
    render(<OrderStatusLookup />);

    fireEvent.submit(screen.getByRole("button", { name: /send secure link/i }));

    expect(await screen.findAllByRole("alert")).toHaveLength(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid order numbers before request", async () => {
    const fetchMock = mockFetch(Promise.resolve({ ok: true }));
    render(<OrderStatusLookup />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "buyer@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/order number/i), {
      target: { value: "ZLX-2026-1" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /send secure link/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/ZLX-20260428-0001/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts normalized payload and renders neutral success copy", async () => {
    const fetchMock = mockFetch(Promise.resolve({ ok: true }));
    render(<OrderStatusLookup />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: " buyer@example.com " },
    });
    fireEvent.change(screen.getByLabelText(/order number/i), {
      target: { value: " zlx-20260428-0007 " },
    });
    fireEvent.submit(screen.getByRole("button", { name: /send secure link/i }));

    expect(await screen.findByText(ORDER_LOOKUP_NEUTRAL_MESSAGE)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/order-lookup-request",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "buyer@example.com",
          order_number: "ZLX-20260428-0007",
        }),
      }),
    );
  });

  it("shows a loading state while the request is pending", async () => {
    let resolveResponse: (value: Partial<Response>) => void = () => {};
    const pending = new Promise<Partial<Response>>((resolve) => {
      resolveResponse = resolve;
    });
    mockFetch(pending);
    render(<OrderStatusLookup />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "buyer@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/order number/i), {
      target: { value: "ZLX-20260428-0007" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /send secure link/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(/sending request/i);
    expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();

    resolveResponse({ ok: true });
    await waitFor(() =>
      expect(screen.getByText(ORDER_LOOKUP_NEUTRAL_MESSAGE)).toBeInTheDocument(),
    );
  });

  it("shows a retryable error on network failure", async () => {
    mockFetch(Promise.reject(new Error("network down")));
    render(<OrderStatusLookup />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "buyer@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/order number/i), {
      target: { value: "ZLX-20260428-0007" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /send secure link/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not send/i);
  });
});
