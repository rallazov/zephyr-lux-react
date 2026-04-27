-- Story 4-2: durable payment_events ledger for Stripe webhooks (idempotency on provider + provider_event_id).
-- RLS: default deny for client JWTs; api/* uses service role only.

CREATE TYPE public.payment_event_ingest_status AS ENUM (
  'received',
  'processed',
  'failed',
  'ignored'
);

CREATE TABLE public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  provider text NOT NULL DEFAULT 'stripe',
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  status public.payment_event_ingest_status NOT NULL DEFAULT 'received',
  payload_hash text NOT NULL,
  claim_lease_until timestamptz,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now (),
  CONSTRAINT payment_events_provider_event_unique UNIQUE (provider, provider_event_id)
);

CREATE INDEX payment_events_provider_event_id_idx ON public.payment_events (provider_event_id);

COMMENT ON TABLE public.payment_events IS 'Webhook audit + idempotency; application maps status to domain ingest_status.';

COMMENT ON COLUMN public.payment_events.claim_lease_until IS 'Short lease to reduce concurrent double-processing for the same Stripe event.id (4-2 AC3).';

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- Claim / idempotency: insert new row or decide skip / retry / busy (transactional).
CREATE OR REPLACE FUNCTION public.claim_payment_event (
  p_provider text,
  p_provider_event_id text,
  p_event_type text,
  p_payload_hash text,
  p_lease_seconds integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_status public.payment_event_ingest_status;
  v_lease timestamptz;
  v_lease_interval interval;
BEGIN
  v_lease_interval := make_interval(secs => GREATEST(1, LEAST(COALESCE(p_lease_seconds, 30), 120)));

  INSERT INTO public.payment_events (
    provider,
    provider_event_id,
    event_type,
    status,
    payload_hash,
    claim_lease_until
  )
  VALUES (
    p_provider,
    p_provider_event_id,
    p_event_type,
    'received',
    p_payload_hash,
    now () + v_lease_interval
  )
  ON CONFLICT (provider, provider_event_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ledger_id', v_id,
      'outcome', 'process'
    );
  END IF;

  SELECT
    pe.id,
    pe.status,
    pe.claim_lease_until INTO v_id,
    v_status,
    v_lease
  FROM
    public.payment_events pe
  WHERE
    pe.provider = p_provider
    AND pe.provider_event_id = p_provider_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ledger_id', NULL, 'outcome', 'error', 'detail', 'row_missing');
  END IF;

  IF v_status IN ('processed', 'ignored') THEN
    RETURN jsonb_build_object('ledger_id', v_id, 'outcome', 'skip_ok');
  END IF;

  IF v_status = 'failed' THEN
    UPDATE public.payment_events
    SET
      status = 'received',
      error_message = NULL,
      processed_at = NULL,
      claim_lease_until = now () + v_lease_interval
    WHERE
      id = v_id
    RETURNING
      id INTO v_id;

    RETURN jsonb_build_object('ledger_id', v_id, 'outcome', 'process');
  END IF;

  -- received
  IF v_lease IS NOT NULL AND v_lease > now() THEN
    RETURN jsonb_build_object('ledger_id', v_id, 'outcome', 'busy');
  END IF;

  UPDATE public.payment_events
  SET
    claim_lease_until = now () + v_lease_interval
  WHERE
    id = v_id
    AND status = 'received'
    AND (
      claim_lease_until IS NULL
      OR claim_lease_until <= now ()
    )
  RETURNING
    id INTO v_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ledger_id', (
        SELECT
          pe2.id
        FROM
          public.payment_events pe2
        WHERE
          pe2.provider = p_provider
          AND pe2.provider_event_id = p_provider_event_id
      ),
      'outcome',
      'busy'
    );
  END IF;

  RETURN jsonb_build_object('ledger_id', v_id, 'outcome', 'process');
END;
$$;

REVOKE ALL ON FUNCTION public.claim_payment_event (text, text, text, text, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.claim_payment_event (text, text, text, text, integer) TO service_role;

GRANT EXECUTE ON FUNCTION public.claim_payment_event (text, text, text, text, integer) TO postgres;
