-- Story 8-3: durable Stripe subscription read model (webhook-driven). No orders/inventory here.

CREATE TYPE public.customer_subscription_status AS ENUM (
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'paused'
);

CREATE TABLE public.customer_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  -- Optional link when a first-class customers table exists (Story 8-3: best-effort only).
  customer_id uuid NULL,
  customer_email text NOT NULL,
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text NOT NULL,
  stripe_latest_invoice_id text,
  -- Unix seconds from Stripe Invoice object (pointer ordering; see Story 8-3 invoice carve-out).
  stripe_latest_invoice_created bigint,
  subscription_plan_id uuid NOT NULL REFERENCES public.product_subscription_plans (id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  variant_id uuid REFERENCES public.product_variants (id) ON DELETE SET NULL,
  status public.customer_subscription_status NOT NULL,
  current_period_start bigint NOT NULL,
  current_period_end bigint NOT NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at bigint,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_from_stripe_event_created bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now (),
  updated_at timestamptz NOT NULL DEFAULT now (),
  CONSTRAINT customer_subscriptions_invoice_created_when_id_chk CHECK (
    stripe_latest_invoice_id IS NULL
    OR stripe_latest_invoice_created IS NOT NULL
  ),
  CONSTRAINT customer_subscriptions_canceled_reasonable_chk CHECK (canceled_at IS NULL OR canceled_at >= 0)
);

COMMENT ON TABLE public.customer_subscriptions IS 'Stripe Billing subscription snapshots (Epic 8). Writes: service_role webhook + server paths; admin SELECT optional.';

COMMENT ON COLUMN public.customer_subscriptions.updated_from_stripe_event_created IS 'Stripe Event.created (unix UTC) last applied to snapshot fields; stale-guard anchor (Story 8-3 AC4).';

CREATE UNIQUE INDEX customer_subscriptions_stripe_subscription_uidx ON public.customer_subscriptions (
  stripe_subscription_id
);

CREATE INDEX customer_subscriptions_stripe_customer_id_idx ON public.customer_subscriptions (stripe_customer_id);

CREATE INDEX customer_subscriptions_plan_id_idx ON public.customer_subscriptions (subscription_plan_id);

CREATE INDEX customer_subscriptions_product_id_idx ON public.customer_subscriptions (product_id);

CREATE OR REPLACE FUNCTION public.customer_subscriptions_set_updated_at ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = public
  AS $$
BEGIN
  NEW.updated_at = now ();
  RETURN NEW;
END;
$$;

CREATE TRIGGER customer_subscriptions_before_update_touch_updated_at
  BEFORE UPDATE ON public.customer_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.customer_subscriptions_set_updated_at ();

ALTER TABLE public.customer_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_subscriptions_admin_select_only ON public.customer_subscriptions
  FOR SELECT
  TO authenticated
  USING (coalesce ((auth.jwt () -> 'app_metadata' ->> 'role'), '') = 'admin');
