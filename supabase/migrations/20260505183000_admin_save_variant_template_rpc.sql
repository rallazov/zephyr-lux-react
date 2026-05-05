-- Story 11-2: Single-transaction variant template persistence for admin CRUD.

CREATE OR REPLACE FUNCTION public.admin_save_variant_template (p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $func$
DECLARE
  v_tid uuid;
  v_name text;
  v_status public.variant_template_status;
  v_axis_ids uuid[] := ARRAY[]::uuid[];
  v_ax_row jsonb;
  v_opt_row jsonb;
  r_ax RECORD;
  r_opt RECORD;
  v_axis_id uuid;
  v_opt_ids uuid[];
  v_opt_id uuid;
BEGIN
  IF coalesce((auth.jwt () -> 'app_metadata' ->> 'role'), '') <> 'admin' THEN
    RAISE EXCEPTION 'Admin role is required' USING ERRCODE = '42501';
  END IF;

  v_name := trim(BOTH FROM coalesce(p_payload->>'name', ''));
  IF v_name = '' THEN RAISE EXCEPTION 'template name is required' USING ERRCODE = '22023'; END IF;

  BEGIN
    v_status := (p_payload->>'status')::public.variant_template_status;
  EXCEPTION
    WHEN invalid_text_representation THEN
      v_status := 'draft'::public.variant_template_status;
  END;

  IF p_payload->>'id' IS NULL OR trim(BOTH FROM (p_payload->>'id')) = '' THEN
    INSERT INTO public.variant_templates (name, status)
    VALUES (v_name, v_status)
    RETURNING id INTO v_tid;
  ELSE
    v_tid := (p_payload->>'id')::uuid;
    UPDATE public.variant_templates SET name = v_name, status = v_status WHERE id = v_tid;
    IF NOT FOUND THEN RAISE EXCEPTION 'Template not found: %', v_tid USING ERRCODE = 'P0002'; END IF;
  END IF;

  SELECT COALESCE(array_agg((t_arr.value ->> 'id')::uuid) FILTER (
    WHERE (t_arr.value ->> 'id')
    IS NOT NULL
    AND trim(BOTH FROM coalesce(t_arr.value ->> 'id', '')) <> ''), ARRAY[]::uuid[])
  INTO v_axis_ids
  FROM jsonb_array_elements(coalesce(p_payload->'axes', '[]'::jsonb)) AS t_arr;

  DELETE FROM public.variant_template_axes vt
    WHERE vt.variant_template_id = v_tid AND NOT vt.id = ANY (v_axis_ids);

  FOR r_ax IN SELECT * FROM jsonb_array_elements(coalesce(p_payload->'axes', '[]'::jsonb))
    LOOP v_ax_row := r_ax.value;

    v_axis_id := (v_ax_row ->> 'id')::uuid;

      IF EXISTS (
        SELECT 1 FROM public.variant_template_axes old_ax
        WHERE old_ax.id = v_axis_id AND old_ax.variant_template_id IS DISTINCT FROM v_tid LIMIT 1
      )
      THEN
        RAISE EXCEPTION 'Axis uuid already belongs to a different template' USING ERRCODE = '23503';
      END IF;

      INSERT INTO public.variant_template_axes (id, variant_template_id, axis_key, label, sort_order)
      VALUES (
      v_axis_id,
      v_tid,
      trim(BOTH FROM v_ax_row ->> 'axis_key'),
      nullif (trim(BOTH FROM coalesce(v_ax_row ->> 'label', '')), ''),
      COALESCE(NULLIF(trim(BOTH FROM coalesce(v_ax_row ->> 'sort_order', '')), '')::int, 0))
      ON CONFLICT (id) DO UPDATE
      SET variant_template_id = excluded.variant_template_id,
        axis_key = excluded.axis_key,
        label = excluded.label,
        sort_order = excluded.sort_order;

      SELECT COALESCE(array_agg((t_opt.value ->> 'id')::uuid) FILTER (
        WHERE (t_opt.value ->> 'id')
        IS NOT NULL
        AND trim(BOTH FROM coalesce(t_opt.value ->> 'id', '')) <> ''), ARRAY[]::uuid[])
        INTO v_opt_ids FROM jsonb_array_elements(coalesce(v_ax_row->'options', '[]'::jsonb)) AS t_opt;

    DELETE FROM public.variant_template_axis_options opt
      WHERE opt.axis_id = v_axis_id AND NOT opt.id = ANY (v_opt_ids);

      FOR r_opt IN SELECT * FROM jsonb_array_elements(coalesce(v_ax_row->'options', '[]'::jsonb))
        LOOP v_opt_row := r_opt.value;
          v_opt_id := (v_opt_row ->> 'id')::uuid;

          IF EXISTS (
            SELECT 1 FROM public.variant_template_axis_options oo
            WHERE oo.id = v_opt_id AND oo.axis_id IS DISTINCT FROM v_axis_id LIMIT 1
          )
          THEN
            RAISE EXCEPTION 'Option uuid already belongs to another axis' USING ERRCODE = '23503';
          END IF;

          INSERT INTO public.variant_template_axis_options (id, axis_id, option_key, label, sort_order)
          VALUES (
          v_opt_id,
          v_axis_id,
          trim(BOTH FROM v_opt_row ->> 'option_key'),
          nullif (trim(BOTH FROM coalesce(v_opt_row ->> 'label', '')), ''),
          COALESCE(NULLIF(trim(BOTH FROM coalesce(v_opt_row ->> 'sort_order', '')), '')::int, 0))
          ON CONFLICT (id) DO UPDATE
        SET axis_id = excluded.axis_id,
          option_key = excluded.option_key,
          label = excluded.label,
          sort_order = excluded.sort_order;

        END LOOP;

    END LOOP;

  RETURN v_tid;
END;

$func$;

REVOKE ALL ON FUNCTION public.admin_save_variant_template (jsonb)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_save_variant_template (jsonb)
TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_variant_template (jsonb)
TO service_role;
