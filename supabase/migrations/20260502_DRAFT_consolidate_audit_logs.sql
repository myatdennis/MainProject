-- DRAFT migration: consolidate RLS policies for public.audit_logs (AUTHENTICATED)
-- Generated: 2026-05-02
-- WARNING: Review and test in staging. This file is a DRAFT and the CREATE POLICY block is commented out.

-- Existing policies detected:
-- - owner_all    qual: ((( SELECT auth.uid() AS uid))::text = (user_id)::text)
-- - deny_authenticated    qual: false

-- Because one policy is unconditional (qual=false), consolidation must be reviewed carefully.

-- Optional: DROP old policies after verification (commented)
-- DROP POLICY IF EXISTS owner_all ON public.audit_logs;
-- DROP POLICY IF EXISTS deny_authenticated ON public.audit_logs;

/*
-- Suggested consolidated policy (CAUTION: includes 'false' OR which is functionally a no-op here)
CREATE POLICY consolidated_authenticated_all ON public.audit_logs
  FOR ALL
  TO authenticated
  USING (
    ((( SELECT auth.uid() AS uid))::text = (user_id)::text)
    OR
    (false)
  )
  WITH CHECK (
    ((( SELECT auth.uid() AS uid))::text = (user_id)::text)
  );
*/

-- To apply: remove the surrounding /* ... */ block, run migration in staging, validate behavior, then you can DROP the old policies if behavior is correct.
