import { describe, expect, it } from "vitest";
import { shipmentFromRow, shipmentRowSchema } from "./shipment";

describe("shipmentRowSchema", () => {
  it("parses canonical PostgREST row", () => {
    const row = shipmentRowSchema.parse({
      id: "00000000-0000-4000-8000-000000000001",
      order_id: "00000000-0000-4000-8000-000000000002",
      carrier: "USPS",
      tracking_number: "9400111899223344556677",
      tracking_url: "https://example.com/track",
      status: "shipped",
      shipped_at: new Date().toISOString(),
      delivered_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    expect(row.order_id).toBe("00000000-0000-4000-8000-000000000002");
  });
});

describe("shipmentFromRow", () => {
  it("maps snake_case ↔ camelCase for admin UI/email templates", () => {
    const row = shipmentRowSchema.parse({
      id: "00000000-0000-4000-8000-000000000001",
      order_id: "00000000-0000-4000-8000-000000000002",
      carrier: null,
      tracking_number: null,
      tracking_url: null,
      status: "pending",
      shipped_at: null,
      delivered_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
    });
    expect(shipmentFromRow(row).orderId).toBe(row.order_id);
    expect(shipmentFromRow(row).trackingNumber).toBeNull();
  });
});
