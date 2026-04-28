-- Story 5-4: order_events + atomic fulfillment transitions (E5-S4)
-- Append-only timeline; mutating transitions update orders + insert one event in one transaction (RPC).

-- ---------------------------------------------------------------------------
-- order_events
-- ---------------------------------------------------------------------------
CREATE TABLE public.order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_events_actor_type_chk CHECK (actor_type IN ('owner', 'system')),
  CONSTRAINT order_events_event_type_nonempty_chk CHECK (char_length(trim (both FROM event_type)) > 0)
);

CREATE INDEX order_events_order_id_created_at_desc_idx ON public.order_events (order_id, created_at DESC);

COMMENT ON TABLE public.order_events IS 'Order timeline (fulfillment, future notes E5-S7); RLS — admin SELECT only; writes via service_role RPC.';

ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY order_events_admin_select ON public.order_events
  FOR SELECT
  TO authenticated
  USING (coalesce((auth.jwt () -> 'app_metadata' ->> 'role'), '') = 'admin');

-- ---------------------------------------------------------------------------
-- apply_fulfillment_transition: SECURITY DEFINER, service_role only
-- Idempotent: same status → no order_events row.
-- Mutating: payment must be paid; single-hop forward pipeline + cancel rules.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_fulfillment_transition (
  p_order_id uuid,
  p_to public.order_fulfillment_status,
  p_actor_user_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_pay public.order_payment_status;
  v_from public.order_fulfillment_status;
  v_ok boolean;
BEGIN
  SELECT
    o.payment_status,
    o.fulfillment_status INTO v_pay,
    v_from
  FROM
    public.orders AS o
  WHERE
    o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'apply_fulfillment_transition: order_not_found';
  END IF;

  IF v_from = p_to THEN
    RETURN jsonb_build_object('ok', true, 'changed', false, 'fulfillment_status', v_from);
  END IF;

  IF v_from IN ('canceled'::public.order_fulfillment_status, 'delivered'::public.order_fulfillment_status) THEN
    RAISE EXCEPTION 'apply_fulfillment_transition: terminal_state';
  END IF;

  IF v_pay IS DISTINCT FROM 'paid'::public.order_payment_status THEN
    RAISE EXCEPTION 'apply_fulfillment_transition: not_paid';
  END IF;

  v_ok := CASE
    WHEN v_from = 'processing'::public.order_fulfillment_status
      AND p_to IN ('packed'::public.order_fulfillment_status, 'canceled'::public.order_fulfillment_status) THEN
      TRUE
    WHEN v_from = 'packed'::public.order_fulfillment_status
      AND p_to IN ('shipped'::public.order_fulfillment_status, 'canceled'::public.order_fulfillment_status) THEN
      TRUE
    WHEN v_from = 'shipped'::public.order_fulfillment_status
      AND p_to = 'delivered'::public.order_fulfillment_status THEN
      TRUE
    ELSE
      FALSE
  END CASE;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'apply_fulfillment_transition: invalid_transition';
  END IF;

  UPDATE
    public.orders
  SET
    fulfillment_status = p_to,
    updated_at = now()
  WHERE
    id = p_order_id;

  INSERT INTO public.order_events (
    order_id,
    event_type,
    message,
    metadata,
    actor_type)
  VALUES (
    p_order_id,
    'fulfillment_status_changed',
    format('Fulfillment: %s → %s', v_from, p_to),
    jsonb_build_object(
      'from', v_from,
      'to', p_to,
      'actor_user_id', p_actor_user_id),
    'owner');

  RETURN jsonb_build_object('ok', true, 'changed', true, 'from', v_from, 'to', p_to);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_fulfillment_transition (uuid, public.order_fulfillment_status, uuid)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.apply_fulfillment_transition (uuid, public.order_fulfillment_status, uuid)
TO service_role;

GRANT EXECUTE ON FUNCTION public.apply_fulfillment_transition (uuid, public.order_fulfillment_status, uuid)
TO postgres;
