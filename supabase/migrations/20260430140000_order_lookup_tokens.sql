-- Story 7-2: secure order-status lookup tokens (Epic 7)
-- Opaque token hashes only — never store raw tokens (AC2).
-- RLS: default deny for anon/authenticated; service_role only.

CREATE TABLE public.order_lookup_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  recipient_email text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now (),
  last_accessed_at timestamptz,
  CONSTRAINT order_lookup_tokens_token_hash_key UNIQUE (token_hash)
);

CREATE INDEX order_lookup_tokens_expires_at_idx ON public.order_lookup_tokens (expires_at);

CREATE INDEX order_lookup_tokens_order_id_created_at_desc_idx ON public.order_lookup_tokens (order_id, created_at DESC);

COMMENT ON TABLE public.order_lookup_tokens IS 'Hashed opaque tokens for /order-status deep links; no anon/auth RLS policies.';

COMMENT ON COLUMN public.order_lookup_tokens.token_hash IS 'SHA-256 (hex) of raw opaque token; raw token MUST NOT be persisted.';

COMMENT ON COLUMN public.order_lookup_tokens.recipient_email IS 'Delivery target at creation time; audit only.';

ALTER TABLE public.order_lookup_tokens ENABLE ROW LEVEL SECURITY;
