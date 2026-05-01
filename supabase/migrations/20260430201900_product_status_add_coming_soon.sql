-- Story 9-3: Postgres enum value (isolated DDL per PG enum transaction rules).
ALTER TYPE public.product_status ADD VALUE 'coming_soon';
