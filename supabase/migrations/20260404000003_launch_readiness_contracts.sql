-- Launch readiness contract hardening
-- Ensures the canonical membership view and critical uniqueness indexes exist.

BEGIN;

DROP VIEW IF EXISTS public.user_organizations_vw;

CREATE VIEW public.user_organizations_vw AS
SELECT
  m.user_id,
  m.organization_id,
  m.role,
  COALESCE(m.status, 'active') AS status,
  COALESCE(m.is_active, true) AS is_active,
  m.accepted_at,
  m.created_at,
  m.updated_at,
  m.last_seen_at,
  o.name AS organization_name,
  o.slug AS organization_slug,
  o.status AS organization_status,
  o.subscription,
  o.features
FROM public.organization_memberships AS m
JOIN public.organizations AS o
  ON o.id = m.organization_id;

GRANT SELECT ON public.user_organizations_vw TO anon;
GRANT SELECT ON public.user_organizations_vw TO authenticated;
GRANT SELECT ON public.user_organizations_vw TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS organization_memberships_organization_id_user_id_idx
  ON public.organization_memberships (organization_id, user_id)
  NULLS NOT DISTINCT;

CREATE UNIQUE INDEX IF NOT EXISTS user_course_progress_unique
  ON public.user_course_progress (user_id, course_id);

CREATE UNIQUE INDEX IF NOT EXISTS user_lesson_progress_unique
  ON public.user_lesson_progress (user_id, lesson_id);

CREATE UNIQUE INDEX IF NOT EXISTS courses_org_slug_unique_idx
  ON public.courses (organization_id, lower(slug))
  WHERE organization_id IS NOT NULL AND slug IS NOT NULL;

COMMIT;
