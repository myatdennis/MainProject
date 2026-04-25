-- Migration: 2026-04-25 - Create helper function to surface JWT claims visible to RLS
-- This function returns the platform_role value from auth.jwt() and from request.jwt.claims

CREATE OR REPLACE FUNCTION public.get_platform_role_claims()
RETURNS TABLE(
  auth_jwt_platform_role text,
  request_jwt_platform_role text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (select auth.jwt() -> 'app_metadata' ->> 'platform_role')::text,
    (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'platform_role')::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: This helper is intended for runtime debugging and can be removed after verification.
