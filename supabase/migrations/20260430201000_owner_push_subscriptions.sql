-- Story 8-6: Owner browser push subscriptions (admin opt-in, server-side persistence).
-- No customer or order payload columns; endpoint is unique per browser subscription.

CREATE TYPE public.owner_push_subscription_status AS ENUM ('active', 'revoked', 'failed');

CREATE TABLE public.owner_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  status public.owner_push_subscription_status NOT NULL DEFAULT 'active',
  last_seen_at timestamptz NOT NULL DEFAULT now (),
  created_at timestamptz NOT NULL DEFAULT now (),
  updated_at timestamptz NOT NULL DEFAULT now ()
);

CREATE INDEX owner_push_subscriptions_user_id_active_idx ON public.owner_push_subscriptions (user_id)
WHERE
  status = 'active';

COMMENT ON TABLE public.owner_push_subscriptions IS 'Admin push endpoints for paid-order alerts; DML via service role API only; admin SELECT own rows.';

ALTER TABLE public.owner_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_push_subscriptions_admin_select ON public.owner_push_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    coalesce((auth.jwt () -> 'app_metadata' ->> 'role'), '') = 'admin'
    AND user_id = (auth.jwt () ->> 'sub')::uuid
  );

CREATE OR REPLACE FUNCTION public.owner_push_subscriptions_set_updated_at ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $$
BEGIN
  NEW.updated_at = now ();
  RETURN NEW;
END;
$$;

CREATE TRIGGER owner_push_subscriptions_before_update_touch_updated_at
  BEFORE UPDATE ON public.owner_push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.owner_push_subscriptions_set_updated_at ();
