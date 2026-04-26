-- Migration: 2026-04-25 - Grant platform_admin SELECT access to user_profiles
-- Additive policy: allows JWTs with app_metadata.platform_role = 'platform_admin' to SELECT all user profiles

ALTER TABLE IF EXISTS public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_admin_full_access_users" ON public.user_profiles;
CREATE POLICY "platform_admin_full_access_users"
  ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'platform_role' = 'platform_admin'
  );

-- Keep existing per-user policies so regular users remain scoped to their own profiles.
