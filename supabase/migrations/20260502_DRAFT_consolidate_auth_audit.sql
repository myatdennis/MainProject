-- DRAFT migration: consolidate RLS policies for public.auth_audit (AUTHENTICATED)
-- Generated: 2026-05-02
-- WARNING: Review and test in staging. This file is a DRAFT and the CREATE POLICY block is commented out.

-- Existing policies detected:
-- - deny_authenticated    qual: false
-- - owner_all    qual: ((( SELECT auth.uid() AS uid))::text = (user_id)::text)

-- Optional: DROP old policies after verification (commented)
-- DROP POLICY IF EXISTS deny_authenticated ON public.auth_audit;
-- DROP POLICY IF EXISTS owner_all ON public.auth_audit;

/*
-- Suggested consolidated policy (CAUTION: contains false OR ...)
CREATE POLICY consolidated_authenticated_all ON public.auth_audit
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
