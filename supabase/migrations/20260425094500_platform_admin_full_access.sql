-- Migration: 2026-04-25 - Grant platform_admin SELECT access to courses
-- This policy allows users whose JWT app_metadata.platform_role == 'platform_admin'
-- to SELECT all rows from public.courses. It is intentionally additive and keeps
-- existing org-scoped policies intact.

ALTER TABLE IF EXISTS public.courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_admin_full_access" ON public.courses;
CREATE POLICY "platform_admin_full_access"
  ON public.courses
  FOR SELECT TO authenticated
  USING (
    (
      current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'platform_role'
    ) = 'platform_admin'
  );

-- NOTE: Keep your existing org-scoped SELECT policy (e.g. allow_select_courses_for_org)
-- so org members remain scoped. Postgres will evaluate multiple policies with OR semantics
-- for the authenticated role; the above policy grants platform_admins a separate path.
