-- DRAFT migration: consolidate RLS policies for public.user_activity_log (AUTHENTICATED)
-- Generated: 2026-05-02
-- WARNING: Review and test in staging. This file is a DRAFT and the CREATE POLICY block is commented out.

-- Existing policies detected:
-- - owner_all    qual: ((( SELECT auth.uid() AS uid))::text = (user_id)::text)
-- - deny_authenticated    qual: false

-- Optional: DROP old policies after verification (commented)
-- DROP POLICY IF EXISTS owner_all ON public.user_activity_log;
-- DROP POLICY IF EXISTS deny_authenticated ON public.user_activity_log;

/*
CREATE POLICY consolidated_authenticated_all ON public.user_activity_log
  FOR ALL
  TO authenticated
  USING (
    (false)
    OR
    (((( SELECT auth.uid() AS uid))::text = (user_id)::text))
  )
  WITH CHECK (
    (((( SELECT auth.uid() AS uid))::text = (user_id)::text))
  );
*/

-- To apply: remove the surrounding /* ... */ block, run migration in staging, validate behavior, then you can DROP the old policies if behavior is correct.
