import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260502103000_public_customers_identity.sql"),
  "utf8"
);

describe("customers identity migration", () => {
  it("creates first-class customer identity with auth linkage and provisioning", () => {
    expect(migrationSql).toContain("CREATE TABLE public.customers");
    expect(migrationSql).toContain(
      "CONSTRAINT customers_auth_user_id_key UNIQUE (auth_user_id)"
    );
    expect(migrationSql).toContain(
      "CONSTRAINT customers_auth_users_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users (id) ON DELETE CASCADE"
    );
    expect(migrationSql).toContain("CREATE TRIGGER customers_after_auth_user_insert");
    expect(migrationSql).toMatch(
      /INSERT INTO public\.customers \(auth_user_id, email\)[\s\S]*FROM auth\.users u/
    );
  });

  it("keeps historical guest rows deploy-safe while indexing customer-linked reads", () => {
    expect(migrationSql).toContain("CREATE INDEX orders_customer_id_idx");
    expect(migrationSql).toContain("CREATE INDEX customer_subscriptions_customer_id_idx");
    expect(migrationSql).toMatch(/orders_customer_id_fkey[\s\S]*ON DELETE SET NULL NOT VALID/);
    expect(migrationSql).toMatch(
      /customer_subscriptions_customer_id_fkey[\s\S]*ON DELETE SET NULL NOT VALID/
    );
  });

  it("upserts customer email on auth.users email update when row may be missing", () => {
    expect(migrationSql).toMatch(
      /customers_sync_email_after_auth_update[\s\S]*ON CONFLICT \(auth_user_id\)[\s\S]*DO UPDATE SET/
    );
  });

  it("documents and enforces narrow customer RLS boundaries", () => {
    expect(migrationSql).toContain("REVIEW NOTES (RLS / FK / service-role)");
    expect(migrationSql).toContain("ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY");
    expect(migrationSql).toContain("auth.uid () = auth_user_id");
    expect(migrationSql).toContain("app_metadata' ->> 'role'), '') = 'admin'");
    expect(migrationSql).toContain("CREATE POLICY customers_update_own");
  });
});
