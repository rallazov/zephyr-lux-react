import { describe, expect, it } from "vitest";
import { deriveCarrierKey, deriveTrackingUrlFromCarrier } from "./trackingUrl";

describe("deriveCarrierKey", () => {
  it("maps common USPS wording", () => {
    expect(deriveCarrierKey("USPS")).toBe("usps");
    expect(deriveCarrierKey("  usps Priority  ")).toBe("usps");
  });

  it("maps UPS/FedEx", () => {
    expect(deriveCarrierKey("UPS Ground")).toBe("ups");
    expect(deriveCarrierKey("FedEx")).toBe("fedex");
  });

  it("returns undefined for unrecognized carriers", () => {
    expect(deriveCarrierKey("DHL")).toBeUndefined();
    expect(deriveCarrierKey("")).toBeUndefined();
  });
});

describe("deriveTrackingUrlFromCarrier", () => {
  it("derive USPS URL when carrier maps and number exists", () => {
    expect(deriveTrackingUrlFromCarrier("USPS", "9400111899223344556677")).toMatch(
      /^https:\/\/tools\.usps\.com\/go\/TrackConfirmAction/iu,
    );
  });

  it("derive UPS/FedEx URLs when mapping matches", () => {
    expect(deriveTrackingUrlFromCarrier("ups", "1Z999AA10123456784")).toContain(
      "ups.com/track",
    );
    expect(deriveTrackingUrlFromCarrier("fedex", "123456789012")).toContain(
      "fedex.com/fedextrack",
    );
  });

  it("returns null when URL cannot be inferred", () => {
    expect(deriveTrackingUrlFromCarrier("DHL Express", "123")).toBeNull();
    expect(deriveTrackingUrlFromCarrier("USPS", null)).toBeNull();
  });
});
