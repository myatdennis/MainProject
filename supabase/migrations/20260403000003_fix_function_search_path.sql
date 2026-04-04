-- Fix Supabase linter warning: function_search_path_mutable
-- Affected functions:
--   public.course_media_assets_set_updated_at  (trigger function)
--   public.upsert_course_full                  (RPC)
--
-- A mutable search_path lets a malicious user shadow system objects by
-- creating same-named functions/tables in a schema that appears earlier
-- in the path. Pinning search_path = '' (or an explicit list) prevents
-- search-path hijacking attacks.
--
-- Best practice per Supabase docs: set search_path = '' and use fully
-- qualified names inside the function body.  Both functions already use
-- fully qualified table references (public.courses, public.modules, etc.)
-- so '' is safe here.
--
-- Note on auth_leaked_password_protection:
--   This cannot be fixed via a migration. Enable it in the Supabase dashboard:
--   Authentication → Providers → Email → "Leaked password protection" toggle.

BEGIN;

-- ============================================================
-- 1. course_media_assets_set_updated_at (trigger function)
-- ============================================================
CREATE OR REPLACE FUNCTION public.course_media_assets_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. upsert_course_full (RPC)
-- ============================================================
CREATE OR REPLACE FUNCTION public.upsert_course_full(p_course jsonb, p_modules jsonb)
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_course_id text;
  v_title text;
  v_slug text;
  v_description text;
  v_status text;
  v_version integer;
  v_org text;
  v_meta jsonb;
  m jsonb;
  l jsonb;
  v_module_id text;
  v_lesson_id text;
  present_module_ids text[] := '{}'::text[];
  present_lesson_ids text[];
BEGIN
  IF p_course IS NULL THEN
    RAISE EXCEPTION 'p_course required';
  END IF;

  v_title := COALESCE(NULLIF(p_course->>'title', ''), NULLIF(p_course->>'name', ''));
  IF v_title IS NULL THEN
    RAISE EXCEPTION 'title required';
  END IF;

  v_slug        := NULLIF(p_course->>'slug', '');
  v_description := NULLIF(p_course->>'description', '');
  v_status      := COALESCE(p_course->>'status', 'draft');
  v_version     := COALESCE(NULLIF(p_course->>'version', '')::int, 1);
  v_org         := NULLIF(
    COALESCE(
      p_course->>'organization_id',
      p_course->>'org_id',
      p_course->>'organizationId'
    ),
    ''
  );
  v_meta := COALESCE(p_course->'meta_json', '{}'::jsonb);

  IF NULLIF(p_course->>'id', '') IS NOT NULL THEN
    v_course_id := TRIM(p_course->>'id');
  ELSE
    v_course_id := gen_random_uuid()::text;
  END IF;

  INSERT INTO public.courses (
    id,
    slug,
    title,
    description,
    status,
    version,
    organization_id,
    meta_json
  )
  VALUES (
    v_course_id,
    v_slug,
    v_title,
    v_description,
    v_status,
    v_version,
    v_org,
    v_meta
  )
  ON CONFLICT (id) DO UPDATE SET
    slug            = EXCLUDED.slug,
    title           = EXCLUDED.title,
    description     = EXCLUDED.description,
    status          = EXCLUDED.status,
    version         = EXCLUDED.version,
    organization_id = EXCLUDED.organization_id,
    meta_json       = EXCLUDED.meta_json;

  -- Collect incoming module IDs
  IF p_modules IS NOT NULL THEN
    FOR m IN SELECT * FROM jsonb_array_elements(p_modules) LOOP
      IF NULLIF(m->>'id', '') IS NOT NULL THEN
        present_module_ids := array_append(present_module_ids, TRIM(m->>'id'));
      END IF;
    END LOOP;
  END IF;

  -- Delete removed modules
  IF array_length(present_module_ids, 1) IS NULL THEN
    DELETE FROM public.modules WHERE course_id = v_course_id;
  ELSE
    DELETE FROM public.modules
    WHERE course_id = v_course_id
      AND id NOT IN (SELECT unnest(present_module_ids));
  END IF;

  -- Upsert modules and their lessons
  IF p_modules IS NOT NULL THEN
    FOR m IN SELECT * FROM jsonb_array_elements(p_modules) LOOP
      v_module_id := COALESCE(NULLIF(m->>'id', ''), gen_random_uuid()::text);

      INSERT INTO public.modules (id, course_id, title, description, order_index)
      VALUES (
        v_module_id,
        v_course_id,
        m->>'title',
        NULLIF(m->>'description', ''),
        COALESCE(NULLIF(m->>'order_index', '')::int, 0)
      )
      ON CONFLICT (id) DO UPDATE SET
        title       = EXCLUDED.title,
        description = EXCLUDED.description,
        order_index = EXCLUDED.order_index;

      -- Collect incoming lesson IDs for this module
      present_lesson_ids := '{}'::text[];
      IF (m ? 'lessons') THEN
        FOR l IN SELECT * FROM jsonb_array_elements(m->'lessons') LOOP
          IF NULLIF(l->>'id', '') IS NOT NULL THEN
            present_lesson_ids := array_append(present_lesson_ids, TRIM(l->>'id'));
          END IF;
        END LOOP;
      END IF;

      -- Delete removed lessons
      IF array_length(present_lesson_ids, 1) IS NULL THEN
        DELETE FROM public.lessons WHERE module_id = v_module_id;
      ELSE
        DELETE FROM public.lessons
        WHERE module_id = v_module_id
          AND id NOT IN (SELECT unnest(present_lesson_ids));
      END IF;

      -- Upsert lessons
      IF (m ? 'lessons') THEN
        FOR l IN SELECT * FROM jsonb_array_elements(m->'lessons') LOOP
          v_lesson_id := COALESCE(NULLIF(l->>'id', ''), gen_random_uuid()::text);

          INSERT INTO public.lessons (
            id,
            module_id,
            type,
            title,
            description,
            order_index,
            duration_s,
            content_json
          )
          VALUES (
            v_lesson_id,
            v_module_id,
            l->>'type',
            l->>'title',
            NULLIF(l->>'description', ''),
            COALESCE(NULLIF(l->>'order_index', '')::int, 0),
            COALESCE((l->>'duration_s')::int, NULL),
            CASE
              WHEN l ? 'completion_rule_json' OR l ? 'completionRule' THEN
                CASE
                  WHEN COALESCE(l->'completion_rule_json', l->'completionRule') IS NULL THEN
                    COALESCE(l->'content_json', '{}'::jsonb) - 'completionRule'
                  ELSE
                    jsonb_set(
                      COALESCE(l->'content_json', '{}'::jsonb),
                      '{completionRule}',
                      COALESCE(l->'completion_rule_json', l->'completionRule')
                    )
                END
              ELSE
                COALESCE(l->'content_json', '{}'::jsonb)
            END
          )
          ON CONFLICT (id) DO UPDATE SET
            type        = EXCLUDED.type,
            title       = EXCLUDED.title,
            description = EXCLUDED.description,
            order_index = EXCLUDED.order_index,
            duration_s  = EXCLUDED.duration_s,
            content_json = EXCLUDED.content_json;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  RETURN v_course_id;
END;
$$;

COMMIT;
