import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { isAdminUser } from "./isAdmin";

function mockUser(overrides: Partial<User> & { app_metadata?: { role?: string } }): User {
  return {
    id: "u1",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
    ...overrides,
  } as User;
}

describe("isAdminUser", () => {
  it("is false for null/undefined", () => {
    expect(isAdminUser(null)).toBe(false);
    expect(isAdminUser(undefined)).toBe(false);
  });

  it("is true when app_metadata.role is admin", () => {
    expect(isAdminUser(mockUser({ app_metadata: { role: "admin" } }))).toBe(true);
  });

  it("is false for non-admin", () => {
    expect(isAdminUser(mockUser({ app_metadata: { role: "user" } }))).toBe(false);
  });
});
