-- Story 5-7: internal notes as order_events (E5-S7)
-- Append-only; admin writes via service_role RPC after JWT verify in api/*.

CREATE OR REPLACE FUNCTION public.append_order_internal_note (
  p_order_id uuid,
  p_message text,
  p_actor_user_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_trim text;
BEGIN
  v_trim := trim(both FROM coalesce(p_message, ''));

  IF v_trim = '' THEN
    RAISE EXCEPTION 'append_order_internal_note: empty_message';
  END IF;

  IF char_length(v_trim) > 8000 THEN
    RAISE EXCEPTION 'append_order_internal_note: message_too_long';
  END IF;

  IF NOT EXISTS (
    SELECT
      1
    FROM
      public.orders AS o
    WHERE
      o.id = p_order_id) THEN
    RAISE EXCEPTION 'append_order_internal_note: order_not_found';
  END IF;

  INSERT INTO public.order_events (
  order_id,
  event_type,
  message,
  metadata,
  actor_type)
VALUES (
  p_order_id,
  'internal_note',
  v_trim,
  jsonb_build_object(
    'actor_user_id', p_actor_user_id,
    'visibility', 'internal'),
  'owner');

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.append_order_internal_note (uuid, text, uuid)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.append_order_internal_note (uuid, text, uuid)
TO service_role;

GRANT EXECUTE ON FUNCTION public.append_order_internal_note (uuid, text, uuid)
TO postgres;
