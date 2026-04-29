// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildOwnerOrderPaidPushPayload, serializeOwnerOrderPaidPushPayload } from "./ownerPushPayload";

describe("ownerPushPayload", () => {
  const validId = "550e8400-e29b-41d4-a716-446655440000";

  it("builds minimal title/body with order number and money only", () => {
    const p = buildOwnerOrderPaidPushPayload({
      orderId: validId,
      orderNumber: "ZLX-42",
      totalCents: 1999,
      currency: "usd",
    });
    expect(p.title).toBe("New paid order");
    expect(p.body).toMatch(/ZLX-42/);
    expect(p.body).toMatch(/19\.99/);
    expect(p.orderId).toBe(validId);
    expect(p.body).not.toContain("@");
    expect(serializeOwnerOrderPaidPushPayload(p)).not.toContain("ship");
  });

  it("rejects invalid order id", () => {
    expect(() =>
      buildOwnerOrderPaidPushPayload({
        orderId: "not-a-uuid",
        orderNumber: "ZLX-1",
        totalCents: 1,
        currency: "usd",
      }),
    ).toThrow();
  });

  it("serializeOwnerOrderPaidPushPayload strips newlines in body", () => {
    const json = serializeOwnerOrderPaidPushPayload({
      title: "T",
      body: "a\nb\tc",
      orderId: validId,
    });
    expect(json).not.toContain("\n");
    expect(JSON.parse(json).body).toContain(" ");
  });
});
