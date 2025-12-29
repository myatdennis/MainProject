-- 2025-11-01 13:00:00 - Harden RLS policies to match actual LMS schema
-- These policies previously referenced placeholder columns (org_id, owner_id, assigned_user_id)
-- which do not exist in the live schema. Update them to use the real columns so the migration executes.

------------------------------------------------------------------------------
-- Courses: published courses are visible to members, drafts limited to owners/admins
------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_select_courses_for_org" ON public.courses;
CREATE POLICY "allow_select_courses_for_org" ON public.courses
  FOR SELECT USING (
    public.courses.status = 'published'
    OR public.courses.organization_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      WHERE m.org_id = public.courses.organization_id
        AND m.user_id = auth.uid()
    )
    OR (public.courses.created_by IS NOT NULL AND public.courses.created_by::text = auth.uid()::text)
  );

DROP POLICY IF EXISTS "allow_manage_courses_for_org_admins" ON public.courses;
CREATE POLICY "allow_manage_courses_for_org_admins" ON public.courses
  FOR ALL USING (
    (
      public.courses.organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.organization_memberships m
        WHERE m.org_id = public.courses.organization_id
          AND m.user_id = auth.uid()
          AND lower(coalesce(m.role, 'member')) IN ('admin','owner','manager','editor')
      )
    )
    OR (
      public.courses.organization_id IS NULL
      AND public.courses.created_by IS NOT NULL
      AND public.courses.created_by::text = auth.uid()::text
    )
  )
  WITH CHECK (
    (
      public.courses.organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.organization_memberships m
        WHERE m.org_id = public.courses.organization_id
          AND m.user_id = auth.uid()
          AND lower(coalesce(m.role, 'member')) IN ('admin','owner','manager','editor')
      )
    )
    OR (
      public.courses.organization_id IS NULL
      AND public.courses.created_by IS NOT NULL
      AND public.courses.created_by::text = auth.uid()::text
    )
  );

------------------------------------------------------------------------------
-- User course enrollments: learners manage their own rows, org admins can read/write
------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.user_course_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_user_see_their_enrollments" ON public.user_course_enrollments;
CREATE POLICY "allow_user_see_their_enrollments" ON public.user_course_enrollments
  FOR SELECT USING (
    public.user_course_enrollments.user_id::text = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.courses c
      JOIN public.organization_memberships m ON m.org_id = c.organization_id
      WHERE c.id = public.user_course_enrollments.course_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "allow_manage_enrollments_by_org_admin" ON public.user_course_enrollments;
CREATE POLICY "allow_manage_enrollments_by_org_admin" ON public.user_course_enrollments
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.courses c
      JOIN public.organization_memberships m ON m.org_id = c.organization_id
      WHERE c.id = public.user_course_enrollments.course_id
        AND m.user_id = auth.uid()
        AND lower(coalesce(m.role, 'member')) IN ('admin','owner','manager','editor')
    )
    OR EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = public.user_course_enrollments.course_id
        AND c.organization_id IS NULL
        AND c.created_by::text = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.courses c
      JOIN public.organization_memberships m ON m.org_id = c.organization_id
      WHERE c.id = public.user_course_enrollments.course_id
        AND m.user_id = auth.uid()
        AND lower(coalesce(m.role, 'member')) IN ('admin','owner','manager','editor')
    )
    OR EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = public.user_course_enrollments.course_id
        AND c.organization_id IS NULL
        AND c.created_by::text = auth.uid()::text
    )
  );

------------------------------------------------------------------------------
-- Assignments: assignees can read their row, org admins manage scoped assignments
------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_user_view_assignments" ON public.assignments;
CREATE POLICY "allow_user_view_assignments" ON public.assignments
  FOR SELECT USING (
    (public.assignments.user_id IS NOT NULL AND public.assignments.user_id::text = auth.uid()::text)
    OR (
      public.assignments.organization_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.organization_memberships m
        WHERE m.org_id = public.assignments.organization_id
          AND m.user_id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = public.assignments.course_id
        AND c.organization_id IS NULL
        AND c.created_by::text = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "allow_manage_assignments_by_admin" ON public.assignments;
CREATE POLICY "allow_manage_assignments_by_admin" ON public.assignments
  FOR ALL USING (
    (
      public.assignments.organization_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.organization_memberships m
        WHERE m.org_id = public.assignments.organization_id
          AND m.user_id = auth.uid()
          AND lower(coalesce(m.role, 'member')) IN ('admin','owner','manager','editor')
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = public.assignments.course_id
        AND c.organization_id IS NULL
        AND c.created_by::text = auth.uid()::text
    )
  )
  WITH CHECK (
    (
      public.assignments.organization_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.organization_memberships m
        WHERE m.org_id = public.assignments.organization_id
          AND m.user_id = auth.uid()
          AND lower(coalesce(m.role, 'member')) IN ('admin','owner','manager','editor')
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = public.assignments.course_id
        AND c.organization_id IS NULL
        AND c.created_by::text = auth.uid()::text
    )
  );

------------------------------------------------------------------------------
-- Lesson progress: learners own their data, org admins can audit
------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.user_lesson_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_user_manage_own_progress" ON public.user_lesson_progress;
CREATE POLICY "allow_user_manage_own_progress" ON public.user_lesson_progress
  FOR ALL USING (
    public.user_lesson_progress.user_id::text = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.lessons l
      JOIN public.modules mo ON mo.id = l.module_id
      JOIN public.courses c ON c.id = mo.course_id
      JOIN public.organization_memberships m ON m.org_id = c.organization_id
      WHERE l.id = public.user_lesson_progress.lesson_id
        AND m.user_id = auth.uid()
        AND lower(coalesce(m.role, 'member')) IN ('admin','owner','manager','editor')
    )
    OR EXISTS (
      SELECT 1
      FROM public.lessons l
      JOIN public.modules mo ON mo.id = l.module_id
      JOIN public.courses c ON c.id = mo.course_id
      WHERE l.id = public.user_lesson_progress.lesson_id
        AND c.organization_id IS NULL
        AND c.created_by::text = auth.uid()::text
    )
  )
  WITH CHECK (
    public.user_lesson_progress.user_id::text = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.lessons l
      JOIN public.modules mo ON mo.id = l.module_id
      JOIN public.courses c ON c.id = mo.course_id
      JOIN public.organization_memberships m ON m.org_id = c.organization_id
      WHERE l.id = public.user_lesson_progress.lesson_id
        AND m.user_id = auth.uid()
        AND lower(coalesce(m.role, 'member')) IN ('admin','owner','manager','editor')
    )
    OR EXISTS (
      SELECT 1
      FROM public.lessons l
      JOIN public.modules mo ON mo.id = l.module_id
      JOIN public.courses c ON c.id = mo.course_id
      WHERE l.id = public.user_lesson_progress.lesson_id
        AND c.organization_id IS NULL
        AND c.created_by::text = auth.uid()::text
    )
  );

------------------------------------------------------------------------------
-- Progress events: users can insert/read their own events, service role has full access
------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.progress_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_insert_progress_events" ON public.progress_events;
CREATE POLICY "allow_insert_progress_events" ON public.progress_events
  FOR INSERT WITH CHECK (
    public.progress_events.user_id::text = auth.uid()::text
  );

DROP POLICY IF EXISTS "allow_select_progress_events" ON public.progress_events;
CREATE POLICY "allow_select_progress_events" ON public.progress_events
  FOR SELECT USING (
    public.progress_events.user_id::text = auth.uid()::text
  );

DROP POLICY IF EXISTS "progress_events_service_role" ON public.progress_events;
CREATE POLICY "progress_events_service_role" ON public.progress_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- End of hardened RLS policies
