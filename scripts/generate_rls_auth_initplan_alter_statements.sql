-- Helper: generate ALTER POLICY statements to replace auth.<function>() with (select auth.<function>())
-- Purpose: Supabase linter warns that auth.<function>() (and similar) may be re-evaluated per row.
-- This script inspects pg_policy for the listed policies and prints ALTER POLICY statements
-- which you should review before running. It does NOT execute the ALTERs.

-- Usage: psql "$DATABASE_URL" -f scripts/generate_rls_auth_initplan_alter_statements.sql
-- or run in psql and copy the output to a file for review.

WITH targets AS (
  VALUES
    ('public','user_gamification_profile','user_gamification_profile_self_read'),
    ('public','user_achievements','user_achievements_self_read'),
    ('public','user_activity_log','user_activity_log_self_read')
),
pol AS (
  SELECT
    ns.nspname,
    rel.relname,
    p.polname,
    pg_get_expr(p.polqual, p.polrelid) AS using_expr,
    pg_get_expr(p.polwithcheck, p.polrelid) AS with_check_expr
  FROM pg_policy p
  JOIN pg_class rel ON rel.oid = p.polrelid
  JOIN pg_namespace ns ON ns.oid = rel.relnamespace
  JOIN (SELECT (v).* FROM (VALUES
    -- schema, table, policy
    (NULL::text, NULL::text, NULL::text)
  ) AS v(col1, col2, col3)) t ON true -- placeholder to allow union later
  WHERE false
)

-- We build the pol set by joining to the target list explicitly to avoid accidental global changes.
SELECT
  format('-- Policy: %I.%I / %I', ns.nspname, rel.relname, p.polname) || E'\n' ||
  format('/* Existing USING: %s */', coalesce(pg_get_expr(p.polqual, p.polrelid), 'NULL')) || E'\n' ||
  format('/* Existing WITH CHECK: %s */', coalesce(pg_get_expr(p.polwithcheck, p.polrelid), 'NULL')) || E'\n' ||
  '\n' ||
  -- Generate ALTER statement text by performing a regexp_replace on auth.<fn>() -> (select auth.<fn>())
  (
    SELECT
      '/* Suggested ALTER (review before running) */' || E'\n' ||
      'ALTER POLICY ' || quote_ident(p.polname) || ' ON ' || quote_ident(ns.nspname) || '.' || quote_ident(rel.relname) || ' USING (' || coalesce(new_using, 'NULL') || ') ' ||
      (CASE WHEN new_withcheck IS NOT NULL THEN ' WITH CHECK (' || new_withcheck || ')' ELSE '' END) || ';'
    FROM (
      SELECT
        p.polname,
        ns.nspname,
        rel.relname,
        -- Replace occurrences of auth.<name>() with (select auth.<name>())
        regexp_replace(coalesce(pg_get_expr(p.polqual, p.polrelid), ''), 'auth\\.([a-zA-Z0-9_]+)\\(\\)', '(select auth.\1())', 'g') AS new_using,
        regexp_replace(coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''), 'auth\\.([a-zA-Z0-9_]+)\\(\\)', '(select auth.\1())', 'g') AS new_withcheck
      ) s
  ) AS suggested_alter
FROM (
  VALUES
    ('public','user_gamification_profile','user_gamification_profile_self_read'),
    ('public','user_achievements','user_achievements_self_read'),
    ('public','user_activity_log','user_activity_log_self_read')
) AS t(schema_name, table_name, policy_name)
JOIN pg_namespace ns ON ns.nspname = t.schema_name
JOIN pg_class rel ON rel.relname = t.table_name AND rel.relnamespace = ns.oid
JOIN pg_policy p ON p.polrelid = rel.oid AND p.polname = t.policy_name;

-- Notes:
-- 1) This script only prints suggested ALTER POLICY statements. Carefully review the printed USING and WITH CHECK
--    expressions before executing them.
-- 2) If a policy's USING or WITH CHECK expression is NULL, the printed value will show NULL.
-- 3) After reviewing, apply statements individually in psql, e.g.:
--      ALTER POLICY user_gamification_profile_self_read ON public.user_gamification_profile USING ( /* expression */ );

