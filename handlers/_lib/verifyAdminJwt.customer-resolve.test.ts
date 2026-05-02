// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const mockGetUser = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock("./env", () => ({
  ENV: {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_ANON_KEY: "anon-test",
  },
}));

describe("verifyAdminJwt — storefront customer linkage helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetUser.mockReset();
  });

  it("normalizeOrderContactEmail lowercases and trims", async () => {
    const mod = await import("./verifyAdminJwt");
    expect(mod.normalizeOrderContactEmail("  Buyer@Example.COM  ")).toBe("buyer@example.com");
  });

  it("resolveVerifiedCustomerIdForCheckoutOrder returns null without bearer token", async () => {
    const mod = await import("./verifyAdminJwt");
    const admin = { from: vi.fn() } as unknown as SupabaseClient;
    await expect(
      mod.resolveVerifiedCustomerIdForCheckoutOrder({ admin, bearerAccessToken: null }),
    ).resolves.toBeNull();
    await expect(
      mod.resolveVerifiedCustomerIdForCheckoutOrder({ admin, bearerAccessToken: "   " }),
    ).resolves.toBeNull();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("resolveVerifiedCustomerIdForCheckoutOrder returns customer id after JWT verification", async () => {
    mockGetUser.mockResolvedValue({
      error: null,
      data: { user: { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" } },
    });

    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "cccccccc-cccc-cccc-cccc-cccccccccccc" },
      error: null,
    });

    const admin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle }),
        }),
      }),
    } as unknown as SupabaseClient;

    const mod = await import("./verifyAdminJwt");
    const id = await mod.resolveVerifiedCustomerIdForCheckoutOrder({
      admin,
      bearerAccessToken: "jwt-here",
    });

    expect(id).toBe("cccccccc-cccc-cccc-cccc-cccccccccccc");
    expect(mockGetUser).toHaveBeenCalledWith("jwt-here");
    expect(admin.from).toHaveBeenCalledWith("customers");
  });

  it("resolveVerifiedCustomerIdForCheckoutOrder returns null when getUser fails", async () => {
    mockGetUser.mockResolvedValue({ error: new Error("bad"), data: { user: null } });

    const admin = {
      from: vi.fn(),
    } as unknown as SupabaseClient;

    const mod = await import("./verifyAdminJwt");
    const id = await mod.resolveVerifiedCustomerIdForCheckoutOrder({
      admin,
      bearerAccessToken: "jwt",
    });
    expect(id).toBeNull();
    expect(admin.from).not.toHaveBeenCalled();
  });
});
