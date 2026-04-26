-- Migration: 2026-04-25T12:30:00Z - One-shot: Standardize platform_admin RLS policies (idempotent)

-- 1) Ensure RLS is enabled
ALTER TABLE IF EXISTS public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 2) Drop any old/mismatched platform_admin policies
DROP POLICY IF EXISTS platform_admin_full_access ON public.courses;
DROP POLICY IF EXISTS platform_admin_full_access_orgs ON public.organizations;
DROP POLICY IF EXISTS platform_admin_full_access_users ON public.user_profiles;

-- 3) Create unified policies using request.jwt.claims (SINGLE SOURCE)
CREATE POLICY platform_admin_full_access
ON public.courses
FOR SELECT
USING (
  (current_setting('request.jwt.claims', true)::json
   -> 'app_metadata'
   ->> 'platform_role') = 'platform_admin'
);

CREATE POLICY platform_admin_full_access_orgs
ON public.organizations
FOR SELECT
USING (
  (current_setting('request.jwt.claims', true)::json
   -> 'app_metadata'
   ->> 'platform_role') = 'platform_admin'
);

CREATE POLICY platform_admin_full_access_users
ON public.user_profiles
FOR SELECT
USING (
  (current_setting('request.jwt.claims', true)::json
   -> 'app_metadata'
   ->> 'platform_role') = 'platform_admin'
);

-- Note: The verification queries below are provided for manual run in the SQL editor.
-- 4) Quick verification (run manually in SQL editor):
-- SELECT 'courses' AS table, COUNT(*) FROM public.courses
-- UNION ALL
-- SELECT 'organizations', COUNT(*) FROM public.organizations
-- UNION ALL
-- SELECT 'user_profiles', COUNT(*) FROM public.user_profiles;

-- 5) Confirm policies exist and use request.jwt.claims (run manually):
-- SELECT tablename, policyname, qual
-- FROM pg_policies
-- WHERE tablename IN ('courses','organizations','user_profiles')
-- ORDER BY tablename, policyname;

-- End of migration
