import { describe, expect, it } from "vitest";
import {
  getOrderLookupFieldErrors,
  parseOrderLookupRequest,
} from "./orderLookupRequest";

describe("order lookup request validation", () => {
  it("trims email and normalizes order number to uppercase", () => {
    const parsed = parseOrderLookupRequest({
      email: " buyer@example.com ",
      order_number: " zlx-20260428-0007 ",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({
        email: "buyer@example.com",
        order_number: "ZLX-20260428-0007",
      });
    }
  });

  it("rejects order numbers outside the current ZLX shape", () => {
    const parsed = parseOrderLookupRequest({
      email: "buyer@example.com",
      order_number: "ZLX-2026-7",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(getOrderLookupFieldErrors(parsed.error).order_number).toMatch(/ZLX-20260428-0001/);
    }
  });

  it("rejects invalid email input", () => {
    const parsed = parseOrderLookupRequest({
      email: "not an email",
      order_number: "ZLX-20260428-0007",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(getOrderLookupFieldErrors(parsed.error).email).toMatch(/valid email/i);
    }
  });
});
