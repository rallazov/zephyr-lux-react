import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ShipmentEvidencePanel } from "./ShipmentEvidencePanel";

describe("ShipmentEvidencePanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows validation when submit without file", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), { status: 200 }),
    );

    render(
      <ShipmentEvidencePanel
        orderId="550e8400-e29b-41d4-a716-446655440000"
        shipmentId="660e8400-e29b-41d4-a716-446655440001"
        canUpload
        accessToken="tok"
      />,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: /upload photo/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/choose an image/i);
  });

  it("disables upload control with uploading label while request in flight", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("admin-shipment-images")) {
        return Promise.resolve(
          new Response(JSON.stringify({ items: [] }), { status: 200 }),
        );
      }
      if (url.includes("admin-shipment-image")) {
        return new Promise(() => {
          /* never resolves — busy state */
        });
      }
      return Promise.resolve(new Response("", { status: 404 }));
    });

    render(
      <ShipmentEvidencePanel
        orderId="550e8400-e29b-41d4-a716-446655440000"
        shipmentId="660e8400-e29b-41d4-a716-446655440001"
        canUpload
        accessToken="tok"
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/loading evidence/i)).not.toBeInTheDocument();
    });

    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "x.jpg", {
      type: "image/jpeg",
    });
    const input = document.getElementById("shipment-evidence-file") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(screen.getByRole("button", { name: /upload photo/i }));

    expect(await screen.findByRole("button", { name: /uploading/i })).toBeDisabled();
  });
});
