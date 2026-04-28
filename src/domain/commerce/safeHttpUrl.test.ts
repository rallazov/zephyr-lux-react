import { describe, expect, it } from "vitest";
import { isSafeHttpUrl, safeHttpUrlForHref } from "./safeHttpUrl";

describe("safeHttpUrl", () => {
  it("accepts absolute http(s) URLs", () => {
    expect(safeHttpUrlForHref("https://example.com/path?q=1")).toBe(
      "https://example.com/path?q=1",
    );
    expect(safeHttpUrlForHref("http://tools.usps.com/track")).toBe(
      "http://tools.usps.com/track",
    );
    expect(isSafeHttpUrl("https://example.com")).toBe(true);
  });

  it("rejects javascript, data, and other protocols", () => {
    expect(safeHttpUrlForHref("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrlForHref("data:text/html,<svg/onload=alert(1)>")).toBeNull();
    expect(safeHttpUrlForHref("ftp://example.com/file")).toBeNull();
    expect(isSafeHttpUrl("javascript:void(0)")).toBe(false);
  });

  it("returns null for malformed URLs", () => {
    expect(safeHttpUrlForHref("not a url")).toBeNull();
    expect(safeHttpUrlForHref("")).toBeNull();
  });
});
