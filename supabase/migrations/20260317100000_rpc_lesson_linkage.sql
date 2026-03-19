-- Migration: Add module_id and course_id to upsert_course_graph lesson return shape
-- Fixes: post-save lesson objects missing module_id/course_id causing chapterId=undefined
-- and requiring a full reload to get proper linkage.
--
-- Must DROP then recreate because PostgreSQL rejects CREATE OR REPLACE when
-- the function's internal structure changed in a prior migration variant.

DROP FUNCTION IF EXISTS public.upsert_course_graph(jsonb, uuid, uuid);

CREATE FUNCTION public.upsert_course_graph(
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
  v_version integer;
  v_now timestamptz := now();
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
  v_version := COALESCE(NULLIF(p_course->>'version', '')::int, 1);

  INSERT INTO public.courses (
    id,
    organization_id,
    slug,
    title,
    description,
    status,
    meta_json,
    key_takeaways,
    version,
    updated_at,
    updated_by
  )
  VALUES (
    v_course_id,
    p_org,
    v_slug,
    COALESCE(p_course->>'title', ''),
    p_course->>'description',
    COALESCE(v_status, 'draft'),
    COALESCE(p_course->'meta_json', '{}'::jsonb),
    COALESCE(p_course->'key_takeaways', p_course->'keyTakeaways', '[]'::jsonb),
    v_version,
    v_now,
    p_actor
  )
  ON CONFLICT (id) DO UPDATE
    SET slug = EXCLUDED.slug,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        meta_json = EXCLUDED.meta_json,
        key_takeaways = EXCLUDED.key_takeaways,
        version = EXCLUDED.version,
        updated_at = v_now,
        updated_by = p_actor,
        organization_id = p_org;

  -- Remove previous modules (cascade removes lessons)
  DELETE FROM public.modules
  WHERE course_id = v_course_id AND organization_id = p_org;

  WITH modules_input AS (
    SELECT
      COALESCE((mod.value->>'id')::uuid, gen_random_uuid()) AS module_id,
      v_course_id AS course_id,
      p_org AS organization_id,
      COALESCE(mod.value->>'title', '') AS title,
      mod.value->>'description' AS description,
      COALESCE((mod.value->>'order_index')::integer, mod.ordinality::integer - 1) AS order_index,
      mod.value AS module_json
    FROM jsonb_array_elements(COALESCE(p_course->'modules', '[]'::jsonb)) WITH ORDINALITY AS mod(value, ordinality)
  ),
  inserted_modules AS (
    INSERT INTO public.modules (
      id,
      course_id,
      organization_id,
      title,
      description,
      order_index,
      created_at,
      updated_at
    )
    SELECT
      module_id,
      course_id,
      organization_id,
      title,
      description,
      order_index,
      v_now,
      v_now
    FROM modules_input
    RETURNING id AS module_id, course_id
  )
  INSERT INTO public.lessons (
    id,
    module_id,
    course_id,
    organization_id,
    title,
    type,
    description,
    order_index,
    duration_s,
    content_json,
    created_at,
    updated_at
  )
  SELECT
    COALESCE((lesson.value->>'id')::uuid, gen_random_uuid()),
    mi.module_id,
    v_course_id,
    p_org,
    COALESCE(lesson.value->>'title', ''),
    COALESCE(lesson.value->>'type', 'text'),
    lesson.value->>'description',
    COALESCE((lesson.value->>'order_index')::integer, lesson.ordinality::integer - 1),
    (lesson.value->>'duration_s')::integer,
    CASE
      WHEN lesson.value ? 'completion_rule_json' OR lesson.value ? 'completionRule' THEN
        CASE
          WHEN COALESCE(lesson.value->'completion_rule_json', lesson.value->'completionRule') IS NULL THEN
            COALESCE(lesson.value->'content_json', lesson.value->'content', '{}'::jsonb) - 'completionRule'
          ELSE
            jsonb_set(
              COALESCE(lesson.value->'content_json', lesson.value->'content', '{}'::jsonb),
              '{completionRule}',
              COALESCE(lesson.value->'completion_rule_json', lesson.value->'completionRule')
            )
        END
      ELSE
        COALESCE(lesson.value->'content_json', lesson.value->'content', '{}'::jsonb)
    END,
    v_now,
    v_now
  FROM modules_input mi
  CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(mi.module_json->'lessons', '[]'::jsonb)
  ) WITH ORDINALITY AS lesson(value, ordinality);

  -- Return full graph with module_id and course_id included in each lesson
  RETURN (
    SELECT jsonb_build_object(
      'id', c.id,
      'organization_id', c.organization_id,
      'slug', c.slug,
      'title', c.title,
      'description', c.description,
      'status', c.status,
      'meta_json', c.meta_json,
      'version', c.version,
      'published_at', c.published_at,
      'updated_at', c.updated_at,
      'modules', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', m.id,
              'course_id', m.course_id,
              'title', m.title,
              'description', m.description,
              'order_index', m.order_index,
              'lessons', COALESCE(
                (
                  SELECT jsonb_agg(
                    jsonb_build_object(
                      'id', l.id,
                      'module_id', l.module_id,
                      'course_id', l.course_id,
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

REVOKE ALL ON FUNCTION public.upsert_course_graph(jsonb, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_course_graph(jsonb, uuid, uuid) TO service_role;

notify pgrst, 'reload schema';
