-- Story 10-1 (Epic 10): Customers table + RLS + passwordless OTP foundation.
--
-- REVIEW NOTES (RLS / FK / service-role):
-- - Rows are created ONLY by SECURITY DEFINER trigger/backfill from auth.users (no JWT INSERT grants).
-- - Browser uses anon JWT + signInWithOtp; anon has no SELECT on customers — customers read own row
--   when authenticated via RLS USING (auth.uid() = auth_user_id).
-- - Admin reads follow JWT app_metadata.role = 'admin' (same pattern as customer_subscriptions).
-- - Service role / Postgres owner bypass RLS for webhooks + server handlers; keep authenticated narrow.
-- - Customer FKs are NOT VALID so deploys do not fail if historical guest-era rows contain unlinked UUIDs;
--   new/updated customer_id values are still enforced after the constraint exists.

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  auth_user_id uuid,
  email text NOT NULL,
  display_name text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now (),
  updated_at timestamptz NOT NULL DEFAULT now (),
  CONSTRAINT customers_auth_user_id_key UNIQUE (auth_user_id),
  CONSTRAINT customers_email_normalized_chk CHECK (email = lower(trim (both FROM email))),
  CONSTRAINT customers_auth_users_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

COMMENT ON TABLE public.customers IS 'Storefront profile; provisioning via auth.users trigger; self RLS read/update plus admin SELECT.';

CREATE INDEX customers_normalized_email_idx ON public.customers (email);

CREATE INDEX orders_customer_id_idx ON public.orders (customer_id)
WHERE
  customer_id IS NOT NULL;

CREATE INDEX customer_subscriptions_customer_id_idx ON public.customer_subscriptions (customer_id)
WHERE
  customer_id IS NOT NULL;

ALTER TABLE public.orders
ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers (id) ON DELETE SET NULL NOT VALID;

ALTER TABLE public.customer_subscriptions
ADD CONSTRAINT customer_subscriptions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers (id) ON DELETE SET NULL NOT VALID;

COMMENT ON COLUMN public.orders.customer_id IS 'REFERENCES public.customers (id); nullable for guests.';

COMMENT ON COLUMN public.customer_subscriptions.customer_id IS 'REFERENCES public.customers (id); nullable until linked.';

CREATE OR REPLACE FUNCTION public.customers_touch_updated_at ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = public
  AS $$
BEGIN
  NEW.updated_at = now ();
  RETURN NEW;
END;
$$;

CREATE TRIGGER customers_before_update_touch_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.customers_touch_updated_at ();

CREATE OR REPLACE FUNCTION public.customers_provision_after_auth_users ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  normalized_email text;
BEGIN
  normalized_email := lower(trim (both FROM coalesce(NEW.email, '')));
  IF normalized_email = '' THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.auth_user_id = NEW.id
  ) THEN
    INSERT INTO public.customers (auth_user_id, email)
    VALUES (NEW.id, normalized_email);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.customers_provision_after_auth_users () FROM PUBLIC;

CREATE TRIGGER customers_after_auth_user_insert
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.customers_provision_after_auth_users ();

CREATE OR REPLACE FUNCTION public.customers_sync_email_after_auth_update ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  normalized_email text;
BEGIN
  IF NEW.email IS NOT DISTINCT FROM OLD.email THEN
    RETURN NEW;
  END IF;
  normalized_email := lower(trim (both FROM coalesce(NEW.email, '')));
  IF normalized_email = '' THEN
    RETURN NEW;
  END IF;
  PERFORM set_config('app.allow_customer_email_sync','on', true);
  INSERT INTO public.customers (auth_user_id, email)
    VALUES (NEW.id, normalized_email)
  ON CONFLICT (auth_user_id)
    DO UPDATE SET
      email = excluded.email,
      updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.customers_sync_email_after_auth_update () FROM PUBLIC;

CREATE TRIGGER customers_after_auth_user_email_update
AFTER UPDATE OF email ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.customers_sync_email_after_auth_update ();

INSERT INTO public.customers (auth_user_id, email)
SELECT
  u.id,
  lower(trim (both FROM u.email))
FROM auth.users u
WHERE
  coalesce(trim (both FROM u.email), '') <> ''
ON CONFLICT (auth_user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.customers_guard_identity_updates ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = public
  AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'customers.id is immutable';
  END IF;
  IF NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
    RAISE EXCEPTION 'customers.auth_user_id is immutable';
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    IF coalesce(current_setting('app.allow_customer_email_sync', true), '') <> 'on' THEN
      RAISE EXCEPTION 'customers.email is managed from Supabase Auth';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER customers_before_update_identity_guard
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.customers_guard_identity_updates ();

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY customers_select_own_or_admin ON public.customers FOR
SELECT TO authenticated USING (
    auth.uid () = auth_user_id
    OR coalesce ((auth.jwt () -> 'app_metadata' ->> 'role'), '') = 'admin'
  );

CREATE POLICY customers_update_own ON public.customers FOR
UPDATE TO authenticated USING (auth.uid () = auth_user_id)
WITH CHECK (auth.uid () = auth_user_id);
