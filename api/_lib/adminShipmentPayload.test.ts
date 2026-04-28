// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  adminShipmentUpsertBodySchema,
  normalizedTrackingUrlForDb,
} from "./adminShipmentPayload";

describe("adminShipmentUpsertBodySchema", () => {
  it("parses snake_case shipment save body", () => {
    const d = adminShipmentUpsertBodySchema.parse({
      order_id: "00000000-0000-4000-8000-000000000001",
      carrier: "  USPS ",
      tracking_number: " 940011 ",
      tracking_url: null,
    });
    expect(d.carrier).toBe("USPS");
    expect(d.tracking_number).toBe("940011");
  });

  it("rejects bad tracking URLs", () => {
    const parsed = adminShipmentUpsertBodySchema.safeParse({
      order_id: "00000000-0000-4000-8000-000000000001",
      tracking_url: "not-a-url",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects extra keys under strict()", () => {
    expect(
      adminShipmentUpsertBodySchema.safeParse({
        order_id: "00000000-0000-4000-8000-000000000001",
        extra_field: true,
      }).success,
    ).toBe(false);
  });
});

describe("normalizedTrackingUrlForDb", () => {
  it("fills USPS template when explicit URL omitted", () => {
    const u = normalizedTrackingUrlForDb({
      carrier: "USPS",
      tracking_number: "9400111899223344556677",
      tracking_url: null,
    });
    expect(u).toContain("tools.usps.com");
  });

  it("prefers manual URL when set", () => {
    expect(
      normalizedTrackingUrlForDb({
        carrier: "USPS",
        tracking_number: "x",
        tracking_url: "https://example.com/t",
      }),
    ).toBe("https://example.com/t");
  });
});
