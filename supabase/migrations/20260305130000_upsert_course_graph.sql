-- Ensure modules/lessons carry org ownership matching the parent course
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.modules ADD COLUMN organization_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.lessons ADD COLUMN organization_id uuid;
  END IF;
END
$$;

-- Backfill organization ownership
UPDATE public.modules m
SET organization_id = c.organization_id
FROM public.courses c
WHERE m.course_id = c.id AND (m.organization_id IS DISTINCT FROM c.organization_id OR m.organization_id IS NULL);

UPDATE public.lessons l
SET organization_id = m.organization_id
FROM public.modules m
WHERE l.module_id = m.id AND (l.organization_id IS DISTINCT FROM m.organization_id OR l.organization_id IS NULL);

-- Enforce NOT NULL constraints
ALTER TABLE public.courses
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.modules
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.lessons
  ALTER COLUMN organization_id SET NOT NULL;

-- Recreate foreign keys with cascading deletes to guarantee graph cleanup
ALTER TABLE public.modules
  DROP CONSTRAINT IF EXISTS modules_course_id_fkey,
  ADD CONSTRAINT modules_course_id_fkey
    FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;

ALTER TABLE public.lessons
  DROP CONSTRAINT IF EXISTS lessons_module_id_fkey,
  ADD CONSTRAINT lessons_module_id_fkey
    FOREIGN KEY (module_id) REFERENCES public.modules(id) ON DELETE CASCADE;

-- Organization-scoped slug uniqueness (case-insensitive)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'courses_org_slug_unique_idx'
  ) THEN
    EXECUTE '
      CREATE UNIQUE INDEX courses_org_slug_unique_idx
      ON public.courses (organization_id, lower(slug))
    ';
  END IF;
END
$$;

-- Helpful indexes for common queries
CREATE INDEX IF NOT EXISTS courses_org_status_updated_idx
  ON public.courses (organization_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS modules_course_order_idx
  ON public.modules (course_id, order_index);

CREATE INDEX IF NOT EXISTS lessons_module_order_idx
  ON public.lessons (module_id, order_index);

-- Atomic course graph upsert RPC
CREATE OR REPLACE FUNCTION public.upsert_course_graph(
  p_course jsonb,
  p_actor uuid,
  p_org uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_course_id uuid;
  v_slug text;
  v_status text;
  v_now timestamptz := now();
  _ignored integer;
BEGIN
  IF p_org IS NULL THEN
    RAISE EXCEPTION 'org_id required';
  END IF;

  IF p_course IS NULL THEN
    RAISE EXCEPTION 'course payload required';
  END IF;

  v_course_id := COALESCE((p_course->>'id')::uuid, gen_random_uuid());
  v_slug := NULLIF(trim(p_course->>'slug'), '');
  IF v_slug IS NULL THEN
    RAISE EXCEPTION 'slug required';
  END IF;
  v_status := NULLIF(p_course->>'status', '');

  INSERT INTO public.courses (
    id,
    organization_id,
    slug,
    title,
    description,
    status,
    meta_json,
    updated_at
  )
  VALUES (
    v_course_id,
    p_org,
    v_slug,
    COALESCE(p_course->>'title', ''),
    p_course->>'description',
    COALESCE(v_status, 'draft'),
    COALESCE(p_course->'meta_json', '{}'::jsonb),
    v_now
  )
  ON CONFLICT (id) DO UPDATE
    SET slug = EXCLUDED.slug,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        meta_json = EXCLUDED.meta_json,
        updated_at = v_now,
        organization_id = p_org
  RETURNING id INTO v_course_id;

  -- Remove previous modules (cascade removes lessons)
  DELETE FROM public.modules
  WHERE course_id = v_course_id AND organization_id = p_org;

  WITH inserted_modules AS (
    INSERT INTO public.modules (id, course_id, organization_id, title, description, order_index, created_at, updated_at)
    SELECT
      COALESCE((mod.value->>'id')::uuid, gen_random_uuid()) AS id,
      v_course_id,
      p_org,
      COALESCE(mod.value->>'title', ''),
      mod.value->>'description',
      COALESCE((mod.value->>'order_index')::integer, mod.ordinality::integer - 1),
      v_now,
      v_now
    FROM jsonb_array_elements(COALESCE(p_course->'modules', '[]'::jsonb)) WITH ORDINALITY AS mod(value, ordinality)
  )
  INSERT INTO public.lessons (id, module_id, organization_id, type, title, description, order_index, duration_s, content_json, created_at, updated_at)
  SELECT
    COALESCE((les.value->>'id')::uuid, gen_random_uuid()) AS id,
    im.id AS module_id,
    p_org,
    COALESCE(les.value->>'type', 'text'),
    COALESCE(les.value->>'title', ''),
    les.value->>'description',
    COALESCE((les.value->>'order_index')::integer, les.ordinality::integer - 1),
    (les.value->>'duration_s')::integer,
    CASE
      WHEN les.value ? 'completion_rule_json' OR les.value ? 'completionRule' THEN
        CASE
          WHEN COALESCE(les.value->'completion_rule_json', les.value->'completionRule') IS NULL THEN
            COALESCE(les.value->'content_json', les.value->'content', '{}'::jsonb) - 'completionRule'
          ELSE
            jsonb_set(
              COALESCE(les.value->'content_json', les.value->'content', '{}'::jsonb),
              '{completionRule}',
              COALESCE(les.value->'completion_rule_json', les.value->'completionRule')
            )
        END
      ELSE
        COALESCE(les.value->'content_json', les.value->'content', '{}'::jsonb)
    END,
    v_now,
    v_now
  FROM jsonb_array_elements(COALESCE(p_course->'modules', '[]'::jsonb)) WITH ORDINALITY AS mod(value, ordinality)
  JOIN inserted_modules im ON im.id = COALESCE((mod.value->>'id')::uuid, im.id)
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(mod.value->'lessons', '[]'::jsonb)) WITH ORDINALITY AS les(value, ordinality)
  RETURNING 1 INTO _ignored;

  RETURN (
    SELECT jsonb_build_object(
      'id', c.id,
      'organization_id', c.organization_id,
      'slug', c.slug,
      'title', c.title,
      'description', c.description,
      'status', c.status,
      'published_at', c.published_at,
      'meta_json', c.meta_json,
      'updated_at', c.updated_at,
      'modules', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', m.id,
              'title', m.title,
              'description', m.description,
              'order_index', m.order_index,
              'lessons', COALESCE(
                (
                  SELECT jsonb_agg(
                    jsonb_build_object(
                      'id', l.id,
                      'type', l.type,
                      'title', l.title,
                      'description', l.description,
                      'order_index', l.order_index,
                      'duration_s', l.duration_s,
                      'content_json', l.content_json,
                      'completion_rule_json', COALESCE(l.content_json->'completionRule', NULL)
                    ) ORDER BY l.order_index
                  )
                  FROM public.lessons l
                  WHERE l.module_id = m.id AND l.organization_id = p_org
                ),
                '[]'::jsonb
              )
            ) ORDER BY m.order_index
          )
          FROM public.modules m
          WHERE m.course_id = c.id AND m.organization_id = p_org
        ),
        '[]'::jsonb
      )
    )
    FROM public.courses c
    WHERE c.id = v_course_id AND c.organization_id = p_org
  );
END;
$$;

-- Restrict execution to privileged roles
REVOKE ALL ON FUNCTION public.upsert_course_graph(jsonb, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_course_graph(jsonb, uuid, uuid) TO service_role;

notify pgrst, 'reload schema';
