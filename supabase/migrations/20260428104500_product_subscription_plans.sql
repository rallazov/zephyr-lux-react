-- Story 8-1 data model consumed by Story 8-2 (Stripe Billing checkout).
-- FK: plan rows attach to storefront products / optional variant.

CREATE TYPE public.subscription_plan_interval AS ENUM (
  'day',
  'week',
  'month',
  'year'
);

CREATE TYPE public.subscription_plan_status AS ENUM (
  'draft',
  'active',
  'archived'
);

CREATE TABLE public.product_subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants (id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  stripe_product_id text,
  stripe_price_id text,
  interval public.subscription_plan_interval NOT NULL DEFAULT 'month',
  interval_count integer NOT NULL DEFAULT 1,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  currency text NOT NULL DEFAULT 'usd',
  trial_period_days integer CHECK (trial_period_days IS NULL OR trial_period_days >= 0),
  status public.subscription_plan_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now (),
  CONSTRAINT product_subscription_plans_interval_count_positive CHECK (interval_count > 0),
  CONSTRAINT product_subscription_plans_active_requires_price CHECK (
    status <> 'active'
    OR (
      stripe_price_id IS NOT NULL
      AND btrim(stripe_price_id) <> ''
    )
  ),
  CONSTRAINT product_subscription_plans_slug_lowercase_trimmed_chk CHECK (
    slug = lower(btrim(slug))
  )
);

-- Active rows only — drafts/archived may reuse slug while iterating (Story 8-1 Spec).
CREATE UNIQUE INDEX product_subscription_plans_active_product_slug_uidx ON public.product_subscription_plans (
  product_id,
  lower(slug)
)
WHERE
  status = 'active';

CREATE UNIQUE INDEX product_subscription_plans_active_stripe_price_uidx ON public.product_subscription_plans (stripe_price_id)
WHERE
  status = 'active'
  AND stripe_price_id IS NOT NULL;

CREATE INDEX product_subscription_plans_product_id_idx ON public.product_subscription_plans (product_id);

CREATE INDEX product_subscription_plans_variant_id_idx ON public.product_subscription_plans (variant_id);

ALTER TABLE public.product_subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY catalog_admin_subscription_plans ON public.product_subscription_plans
  FOR ALL
  TO authenticated
  USING (coalesce((auth.jwt () -> 'app_metadata' ->> 'role'), '') = 'admin')
  WITH CHECK (coalesce((auth.jwt () -> 'app_metadata' ->> 'role'), '') = 'admin');

-- Storefront anon: active plans tied to browsable catalog (parents already active via products RLS).
CREATE POLICY product_subscription_plans_storefront_select ON public.product_subscription_plans FOR SELECT TO anon USING (
  status = 'active'
  AND EXISTS (
    SELECT 1
    FROM public.products p
    WHERE
      p.id = product_subscription_plans.product_id
      AND p.status = 'active'
  )
);

CREATE OR REPLACE FUNCTION public.product_subscription_plans_set_updated_at ()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $tg$
BEGIN
  NEW.updated_at = now ();
  RETURN NEW;
END
$tg$;

CREATE TRIGGER product_subscription_plans_before_update_touch_updated_at
BEFORE UPDATE ON public.product_subscription_plans
FOR EACH ROW
EXECUTE FUNCTION public.product_subscription_plans_set_updated_at ();
