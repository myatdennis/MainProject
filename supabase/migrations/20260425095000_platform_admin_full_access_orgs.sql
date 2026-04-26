-- Migration: 2026-04-25 - Grant platform_admin SELECT access to organizations
-- Additive policy: allows JWTs with app_metadata.platform_role = 'platform_admin' to SELECT all organizations

ALTER TABLE IF EXISTS public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_admin_full_access_orgs" ON public.organizations;
CREATE POLICY "platform_admin_full_access_orgs"
  ON public.organizations
  FOR SELECT TO authenticated
  USING (
    current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'platform_role' = 'platform_admin'
  );

-- Keep existing org-scoped policies intact so organization members remain scoped.
