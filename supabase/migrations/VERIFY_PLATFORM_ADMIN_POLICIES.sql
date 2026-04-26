-- Verification SQL: list policies for courses, organizations, user_profiles
SELECT
  schemaname,
  tablename,
  policyname,
  qual
FROM pg_policies
WHERE tablename IN ('courses', 'organizations', 'user_profiles')
ORDER BY tablename, policyname;

-- Quick check for the exact string 'request.jwt.claims' in policy quals
SELECT
  tablename,
  policyname,
  qual LIKE '%request.jwt.claims%' AS uses_request_jwt_claims
FROM pg_policies
WHERE tablename IN ('courses', 'organizations', 'user_profiles')
ORDER BY tablename, policyname;
