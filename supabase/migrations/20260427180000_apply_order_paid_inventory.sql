-- Story 4-4: idempotent inventory decrement for paid orders (one movement per order line).
-- Oversell: raises insufficient_inventory — webhook nacks (500) so Stripe retries for ops reconcile.
-- Idempotency: inventory_movements.order_item_id UNIQUE (order_paid).

ALTER TABLE public.inventory_movements
ADD COLUMN IF NOT EXISTS order_item_id uuid REFERENCES public.order_items (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_movements_order_item_order_paid_uniq ON public.inventory_movements (order_item_id)
WHERE
  order_item_id IS NOT NULL
  AND reason = 'order_paid';

COMMENT ON COLUMN public.inventory_movements.order_item_id IS '4-4: ties a movement to a specific order line for idempotent apply per webhook retry.';

-- ---------------------------------------------------------------------------
-- Single transaction: resolve variant (SKU backfill), decrement stock, insert movements.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_order_paid_inventory (p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_order public.orders%ROWTYPE;
  r_item RECORD;
  v_variant_id uuid;
  v_on_hand integer;
BEGIN
  SELECT
    * INTO r_order
  FROM
    public.orders
  WHERE
    id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'apply_order_paid_inventory: order_not_found %', p_order_id;
  END IF;

  IF r_order.payment_status IS DISTINCT FROM 'paid'::public.order_payment_status THEN
    RAISE EXCEPTION 'apply_order_paid_inventory: order_not_paid %', p_order_id;
  END IF;

  FOR r_item IN
  SELECT
    id,
    sku,
    quantity,
    variant_id
  FROM
    public.order_items
  WHERE
    order_id = p_order_id
  ORDER BY
    created_at,
    id
  LOOP
    IF EXISTS (
      SELECT
        1
      FROM
        public.inventory_movements
      WHERE
        order_item_id = r_item.id
        AND reason = 'order_paid'::public.inventory_movement_reason
    ) THEN
      CONTINUE;
    END IF;

    v_variant_id := r_item.variant_id;

    IF v_variant_id IS NULL THEN
      SELECT
        id INTO v_variant_id
      FROM
        public.product_variants
      WHERE
        sku = r_item.sku
      LIMIT 1;

      IF v_variant_id IS NOT NULL THEN
        UPDATE public.order_items
        SET
          variant_id = v_variant_id
        WHERE
          id = r_item.id
          AND variant_id IS NULL;
      END IF;
    END IF;

    IF v_variant_id IS NULL THEN
      RAISE EXCEPTION 'apply_order_paid_inventory: unresolved_variant sku=% order_item=%', r_item.sku, r_item.id;
    END IF;

    SELECT
      inventory_quantity INTO v_on_hand
    FROM
      public.product_variants
    WHERE
      id = v_variant_id
    FOR UPDATE;

    IF v_on_hand < r_item.quantity THEN
      RAISE EXCEPTION 'apply_order_paid_inventory: insufficient_inventory sku=% need=% have=%', r_item.sku, r_item.quantity, v_on_hand;
    END IF;

    UPDATE public.product_variants
    SET
      inventory_quantity = inventory_quantity - r_item.quantity,
      updated_at = now()
    WHERE
      id = v_variant_id;

    INSERT INTO public.inventory_movements (
      variant_id,
      order_id,
      order_item_id,
      delta,
      reason
    )
    VALUES (
      v_variant_id,
      p_order_id,
      r_item.id,
      -r_item.quantity,
      'order_paid'::public.inventory_movement_reason
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_order_paid_inventory (uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.apply_order_paid_inventory (uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.apply_order_paid_inventory (uuid) TO postgres;
