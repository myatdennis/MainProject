-- Add many-to-many organization/course availability.
--
-- courses.organization_id remains as a legacy authoring/default-org column for
-- compatibility, but access and assignment flows should use this table plus
-- assignments for org/user scoping.

BEGIN;

CREATE TABLE IF NOT EXISTS public.organization_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, course_id)
);

CREATE INDEX IF NOT EXISTS organization_courses_org_idx
  ON public.organization_courses (organization_id);

CREATE INDEX IF NOT EXISTS organization_courses_course_idx
  ON public.organization_courses (course_id);

CREATE INDEX IF NOT EXISTS organization_courses_org_course_idx
  ON public.organization_courses (organization_id, course_id);

INSERT INTO public.organization_courses (organization_id, course_id)
SELECT c.organization_id, c.id
FROM public.courses c
WHERE c.organization_id IS NOT NULL
ON CONFLICT (organization_id, course_id) DO NOTHING;

ALTER TABLE public.organization_courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_courses_service_full_access ON public.organization_courses;
DROP POLICY IF EXISTS organization_courses_member_read ON public.organization_courses;
DROP POLICY IF EXISTS organization_courses_admin_manage ON public.organization_courses;

CREATE POLICY organization_courses_service_full_access
  ON public.organization_courses
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY organization_courses_member_read
  ON public.organization_courses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      WHERE m.organization_id = public.organization_courses.organization_id
        AND m.user_id = (SELECT auth.uid())
        AND COALESCE(m.status, 'active') = 'active'
    )
  );

CREATE POLICY organization_courses_admin_manage
  ON public.organization_courses
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      WHERE m.organization_id = public.organization_courses.organization_id
        AND m.user_id = (SELECT auth.uid())
        AND COALESCE(m.status, 'active') = 'active'
        AND m.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      WHERE m.organization_id = public.organization_courses.organization_id
        AND m.user_id = (SELECT auth.uid())
        AND COALESCE(m.status, 'active') = 'active'
        AND m.role IN ('owner', 'admin')
    )
  );

COMMIT;
