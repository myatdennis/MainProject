-- Migration: 2026-04-25T12:00:00Z - Standardize platform_admin RLS policies to use request.jwt.claims only

-- Drop any existing platform_admin policies (safe if they don't exist)
DROP POLICY IF EXISTS platform_admin_full_access ON public.courses;
DROP POLICY IF EXISTS "platform_admin_full_access" ON public.courses;
DROP POLICY IF EXISTS platform_admin_full_access_orgs ON public.organizations;
DROP POLICY IF EXISTS "platform_admin_full_access_orgs" ON public.organizations;
DROP POLICY IF EXISTS platform_admin_full_access_users ON public.user_profiles;
DROP POLICY IF EXISTS "platform_admin_full_access_users" ON public.user_profiles;

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create standardized policies that only use current_setting('request.jwt.claims', true)::json
CREATE POLICY platform_admin_full_access
  ON public.courses
  FOR SELECT TO authenticated
  USING (
    current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'platform_role' = 'platform_admin'
  );

CREATE POLICY platform_admin_full_access_orgs
  ON public.organizations
  FOR SELECT TO authenticated
  USING (
    current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'platform_role' = 'platform_admin'
  );

CREATE POLICY platform_admin_full_access_users
  ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'platform_role' = 'platform_admin'
  );

-- Optionally: if you have surveys in a single table and want platform_admin to see them, add similar policy
-- Update the table name below if your surveys table differs (e.g., 'surveys' or 'admin_surveys')
-- Uncomment and adjust as needed:
--
-- ALTER TABLE IF EXISTS public.surveys ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS platform_admin_full_access_surveys ON public.surveys;
-- CREATE POLICY platform_admin_full_access_surveys
--   ON public.surveys
--   FOR SELECT TO authenticated
--   USING (
--     current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'platform_role' = 'platform_admin'
--   );

-- End of migration
