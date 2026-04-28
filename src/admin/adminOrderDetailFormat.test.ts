import { describe, expect, it } from "vitest";
import {
  buildOrderTimeline,
  compareTimelineEntries,
  formatDomainEnumLabel,
  formatInternalNoteActorLabel,
  isPlausibleOrderEmailForMailto,
  isValidOrderIdParam,
  parseShippingAddressJson,
} from "./adminOrderDetailFormat";

describe("isValidOrderIdParam", () => {
  it("accepts RFC UUID strings", () => {
    expect(isValidOrderIdParam("00000000-0000-4000-8000-000000000001")).toBe(true);
  });

  it("rejects invalid UUID", () => {
    expect(isValidOrderIdParam("not-a-uuid")).toBe(false);
    expect(isValidOrderIdParam(undefined)).toBe(false);
  });
});

describe("parseShippingAddressJson", () => {
  it("formats a valid snapshot into lines", () => {
    const r = parseShippingAddressJson({
      name: "Ada Lovelace",
      line1: "1 Ship St",
      city: "London",
      state: "ENG",
      postal_code: "SW1A 1AA",
      country: "GB",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.lines.join("\n")).toContain("Ada Lovelace");
      expect(r.lines.join("\n")).toContain("1 Ship St");
    }
  });

  it("returns fallback when JSON invalid", () => {
    const r = parseShippingAddressJson({ line1: "" });
    expect(r.ok).toBe(false);
    expect(r.lines[0]).toMatch(/invalid/i);
  });
});

describe("formatDomainEnumLabel", () => {
  it("formats snake_case enums", () => {
    expect(formatDomainEnumLabel("pending_payment")).toBe("Pending Payment");
  });
});

describe("formatInternalNoteActorLabel", () => {
  it("returns shortened stable prefix for UUID", () => {
    expect(formatInternalNoteActorLabel("550e8400-e29b-41d4-a716-446655440000")).toBe("…550e8400");
  });

  it("handles empty string", () => {
    expect(formatInternalNoteActorLabel("")).toBe("Unknown actor");
  });
});

describe("isPlausibleOrderEmailForMailto", () => {
  it("accepts normal emails", () => {
    expect(isPlausibleOrderEmailForMailto("buyer@example.com")).toBe(true);
  });

  it("rejects placeholder and invalid", () => {
    expect(isPlausibleOrderEmailForMailto("—")).toBe(false);
    expect(isPlausibleOrderEmailForMailto("not-an-email")).toBe(false);
  });
});

describe("compareTimelineEntries", () => {
  it("sorts invalid at strings deterministically after valid timestamps", () => {
    const a = { at: "2026-01-01T12:00:00.000Z", tieBreak: 0, title: "A" };
    const b = { at: "not-a-date", tieBreak: 0, title: "B" };
    expect(compareTimelineEntries(a, b)).toBeLessThan(0);
    expect(compareTimelineEntries(b, b)).toBe(0);
  });

  it("uses tieBreak when parse tie on same instant", () => {
    const t = "2026-01-01T12:00:00.000Z";
    const first = { at: t, tieBreak: 0, title: "Order placed" };
    const second = { at: t, tieBreak: 1, title: "Payment confirmed" };
    expect(compareTimelineEntries(first, second)).toBeLessThan(0);
  });
});

describe("buildOrderTimeline", () => {
  it("always includes order placed", () => {
    const rows = buildOrderTimeline(
      {
        created_at: "2026-01-01T12:00:00.000Z",
        updated_at: "2026-01-01T12:00:01.000Z",
        payment_status: "pending_payment",
        owner_order_paid_notified_at: null,
        customer_confirmation_sent_at: null,
      },
      []
    );
    expect(rows.some((r) => r.title === "Order placed")).toBe(true);
  });

  it("sorts deterministically when timestamps collide", () => {
    const t = "2026-01-01T12:00:00.000Z";
    const rows = buildOrderTimeline(
      {
        created_at: t,
        updated_at: t,
        payment_status: "paid",
        owner_order_paid_notified_at: null,
        customer_confirmation_sent_at: null,
      },
      []
    );
    const titles = rows.map((r) => r.title);
    expect(titles.indexOf("Order placed")).toBeLessThan(titles.indexOf("Payment confirmed"));
  });

  it("includes notification logs in order", () => {
    const rows = buildOrderTimeline(
      {
        created_at: "2026-01-01T12:00:00.000Z",
        updated_at: "2026-01-01T12:00:00.000Z",
        payment_status: "pending_payment",
        owner_order_paid_notified_at: null,
        customer_confirmation_sent_at: null,
      },
      [
        {
          id: "a",
          channel: "email",
          template: "owner_order_paid",
          status: "sent",
          created_at: "2026-01-02T12:00:00.000Z",
          sent_at: "2026-01-02T12:00:01.000Z",
        },
      ]
    );
    expect(rows.some((r) => r.title.startsWith("Notification:"))).toBe(true);
  });
});
