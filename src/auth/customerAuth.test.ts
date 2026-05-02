import type { EmailOtpType, Session } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  customerSignInWithEmailOtp,
  resolveCustomerOtpRedirectUrl,
  verifyCustomerEmailOtp,
} from "./customerAuth";

const signInWithOtp = vi.fn();
const verifyOtp = vi.fn();
const refreshSession = vi.fn();
const mockClient = {
  auth: { signInWithOtp, verifyOtp, refreshSession },
};
const configuredRef = { value: true };
const browserClientRef = { value: mockClient as typeof mockClient | null };

vi.mock("../lib/supabaseBrowser", () => ({
  getSupabaseBrowserClient: () => browserClientRef.value,
  isSupabaseBrowserConfigured: () => configuredRef.value,
}));

describe("customerAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configuredRef.value = true;
    browserClientRef.value = mockClient;
    signInWithOtp.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: null });
    refreshSession.mockResolvedValue({
      error: null,
      data: { session: { access_token: "refreshed" } as Session },
    });
  });

  describe("resolveCustomerOtpRedirectUrl", () => {
    it("appends the account path to window.location.origin in the browser test env", () => {
      expect(resolveCustomerOtpRedirectUrl()).toBe(`${window.location.origin}/account`);
    });
  });

  describe("customerSignInWithEmailOtp", () => {
    it("returns a clear error when Supabase browser env is not configured", async () => {
      configuredRef.value = false;
      browserClientRef.value = null;

      const { error } = await customerSignInWithEmailOtp("a@test.com");

      expect(error?.message).toBe("Supabase is not configured");
      expect(signInWithOtp).not.toHaveBeenCalled();
    });

    it("rejects blank email input", async () => {
      const { error } = await customerSignInWithEmailOtp("   ");

      expect(error?.message).toBe("Email is required");
      expect(signInWithOtp).not.toHaveBeenCalled();
    });

    it("calls signInWithOtp with trimmed email and default redirect mapped to /account", async () => {
      await customerSignInWithEmailOtp(" hi@test.com ");

      expect(signInWithOtp).toHaveBeenCalledWith({
        email: "hi@test.com",
        options: { emailRedirectTo: `${window.location.origin}/account` },
      });
    });

    it("honors explicit emailRedirectTo override", async () => {
      await customerSignInWithEmailOtp("hi@test.com", {
        emailRedirectTo: "https://example.com/callback",
      });

      expect(signInWithOtp).toHaveBeenCalledWith({
        email: "hi@test.com",
        options: { emailRedirectTo: "https://example.com/callback" },
      });
    });

    it("rejects whitespace-only emailRedirectTo without calling signInWithOtp", async () => {
      const { error } = await customerSignInWithEmailOtp("hi@test.com", {
        emailRedirectTo: "   ",
      });

      expect(error?.message).toBe("Email redirect URL is required");
      expect(signInWithOtp).not.toHaveBeenCalled();
    });

    it("surfaces Supabase errors as Error instances", async () => {
      const authErr = Object.assign(new Error("rate limited"), { status: 429 });
      signInWithOtp.mockResolvedValueOnce({ error: authErr });

      const { error } = await customerSignInWithEmailOtp("hi@test.com");

      expect(error).toBe(authErr);
    });
  });

  describe("verifyCustomerEmailOtp", () => {
    const base = {
      email: "who@test.com",
      token: "123456",
      type: "email" as EmailOtpType,
    };

    it("returns a clear error when Supabase browser env is not configured", async () => {
      configuredRef.value = false;
      browserClientRef.value = null;

      const { error } = await verifyCustomerEmailOtp(base);

      expect(error?.message).toBe("Supabase is not configured");
      expect(verifyOtp).not.toHaveBeenCalled();
    });

    it("rejects blank email or token before calling verifyOtp", async () => {
      const missingEmail = await verifyCustomerEmailOtp({ ...base, email: "" });
      expect(missingEmail.error?.message).toBe(
        "Email and verification token are required"
      );
      expect(verifyOtp).not.toHaveBeenCalled();

      verifyOtp.mockClear();
      const missingToken = await verifyCustomerEmailOtp({ ...base, token: "  " });
      expect(missingToken.error?.message).toBe(
        "Email and verification token are required"
      );
      expect(verifyOtp).not.toHaveBeenCalled();
    });

    it("rejects whitespace-only redirectTo before calling verifyOtp", async () => {
      const { error } = await verifyCustomerEmailOtp({
        ...base,
        redirectTo: "  ",
      });

      expect(error?.message).toBe("Redirect URL cannot be empty");
      expect(verifyOtp).not.toHaveBeenCalled();
    });

    it("returns refreshSession errors after successful OTP verification", async () => {
      const sessErr = new Error("refresh failed");
      refreshSession.mockResolvedValueOnce({ error: sessErr, data: { session: null } });

      const { error } = await verifyCustomerEmailOtp(base);

      expect(error).toBe(sessErr);
      expect(verifyOtp).toHaveBeenCalledTimes(1);
    });

    it("returns error when refresh succeeds without a session", async () => {
      refreshSession.mockResolvedValueOnce({ error: null, data: { session: null } });

      const { error } = await verifyCustomerEmailOtp(base);

      expect(error?.message).toBe("Session was not established after verification");
      expect(verifyOtp).toHaveBeenCalledTimes(1);
      expect(refreshSession).toHaveBeenCalledTimes(1);
    });

    it("calls verifyOtp with trimmed identifiers and forwards redirectTo option", async () => {
      await verifyCustomerEmailOtp({
        email: " a@test.com ",
        token: " 999 ",
        type: "signup",
        redirectTo: "https://example.com/next",
      });

      expect(verifyOtp).toHaveBeenCalledWith({
        email: "a@test.com",
        token: "999",
        type: "signup",
        options: { redirectTo: "https://example.com/next" },
      });
      expect(refreshSession).toHaveBeenCalledTimes(1);
    });

    it("does not refresh the session after a failed OTP verification", async () => {
      const authErr = new Error("otp invalid");
      verifyOtp.mockResolvedValueOnce({ error: authErr });

      const { error } = await verifyCustomerEmailOtp(base);

      expect(error).toBe(authErr);
      expect(refreshSession).not.toHaveBeenCalled();
    });

    it("omits redirect options when redirectTo not provided", async () => {
      await verifyCustomerEmailOtp(base);

      expect(verifyOtp).toHaveBeenCalledWith({
        ...base,
        options: undefined,
      });
      expect(refreshSession).toHaveBeenCalledTimes(1);
    });
  });
});
