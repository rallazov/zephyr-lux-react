// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getBearerAuthorizationHeader } from "./verifyAdminJwt";

describe("getBearerAuthorizationHeader", () => {
  it("parses Bearer token", () => {
    expect(getBearerAuthorizationHeader("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("handles array header shapes", () => {
    expect(getBearerAuthorizationHeader(["Bearer only-one"])).toBe("only-one");
  });

  it("returns null when missing", () => {
    expect(getBearerAuthorizationHeader(undefined)).toBeNull();
    expect(getBearerAuthorizationHeader("")).toBeNull();
  });
});
