DO $$
DECLARE
  policy_exists boolean;
BEGIN
  -- Course assignment service policy cleanup
  SELECT true INTO policy_exists
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'course_assignments'
    AND policyname = 'course_assignments_service_all';

  IF policy_exists THEN
    EXECUTE 'DROP POLICY "course_assignments_service_all" ON public.course_assignments';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_course_progress'
      AND policyname = 'user_course_progress_self'
  ) THEN
    EXECUTE 'DROP POLICY "user_course_progress_self" ON public.user_course_progress';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'course_assignments'
      AND policyname = 'course_assignments_service_select'
  ) THEN
    EXECUTE '
      CREATE POLICY "course_assignments_service_select"
      ON public.course_assignments
      FOR SELECT
      USING (auth.role() = ''service_role'')
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'course_assignments'
      AND policyname = 'course_assignments_service_insert'
  ) THEN
    EXECUTE '
      CREATE POLICY "course_assignments_service_insert"
      ON public.course_assignments
      FOR INSERT
      WITH CHECK (auth.role() = ''service_role'')
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'course_assignments'
      AND policyname = 'course_assignments_service_update'
  ) THEN
    EXECUTE '
      CREATE POLICY "course_assignments_service_update"
      ON public.course_assignments
      FOR UPDATE
      USING (auth.role() = ''service_role'')
      WITH CHECK (auth.role() = ''service_role'')
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'course_assignments'
      AND policyname = 'course_assignments_service_delete'
  ) THEN
    EXECUTE '
      CREATE POLICY "course_assignments_service_delete"
      ON public.course_assignments
      FOR DELETE
      USING (auth.role() = ''service_role'')
    ';
  END IF;

  -- user_course_progress self policies (per operation)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_course_progress'
      AND policyname = 'user_course_progress_self_select'
  ) THEN
    EXECUTE '
      CREATE POLICY "user_course_progress_self_select"
      ON public.user_course_progress
      FOR SELECT
      USING (user_id = auth.uid())
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_course_progress'
      AND policyname = 'user_course_progress_self_insert'
  ) THEN
    EXECUTE '
      CREATE POLICY "user_course_progress_self_insert"
      ON public.user_course_progress
      FOR INSERT
      WITH CHECK (user_id = auth.uid())
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_course_progress'
      AND policyname = 'user_course_progress_self_update'
  ) THEN
    EXECUTE '
      CREATE POLICY "user_course_progress_self_update"
      ON public.user_course_progress
      FOR UPDATE
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid())
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_course_progress'
      AND policyname = 'user_course_progress_self_delete'
  ) THEN
    EXECUTE '
      CREATE POLICY "user_course_progress_self_delete"
      ON public.user_course_progress
      FOR DELETE
      USING (user_id = auth.uid())
    ';
  END IF;

  -- Replace legacy combined service policy with per-operation variants
  SELECT true INTO policy_exists
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'user_course_progress'
    AND policyname = 'user_course_progress_service';

  IF policy_exists THEN
    EXECUTE 'DROP POLICY "user_course_progress_service" ON public.user_course_progress';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_course_progress'
      AND policyname = 'user_course_progress_service_select'
  ) THEN
    EXECUTE '
      CREATE POLICY "user_course_progress_service_select"
      ON public.user_course_progress
      FOR SELECT
      USING (auth.role() = ''service_role'')
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_course_progress'
      AND policyname = 'user_course_progress_service_insert'
  ) THEN
    EXECUTE '
      CREATE POLICY "user_course_progress_service_insert"
      ON public.user_course_progress
      FOR INSERT
      WITH CHECK (auth.role() = ''service_role'')
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_course_progress'
      AND policyname = 'user_course_progress_service_update'
  ) THEN
    EXECUTE '
      CREATE POLICY "user_course_progress_service_update"
      ON public.user_course_progress
      FOR UPDATE
      USING (auth.role() = ''service_role'')
      WITH CHECK (auth.role() = ''service_role'')
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_course_progress'
      AND policyname = 'user_course_progress_service_delete'
  ) THEN
    EXECUTE '
      CREATE POLICY "user_course_progress_service_delete"
      ON public.user_course_progress
      FOR DELETE
      USING (auth.role() = ''service_role'')
    ';
  END IF;
END $$;
