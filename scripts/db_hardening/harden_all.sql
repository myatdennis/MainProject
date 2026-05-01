-- DB hardening script for Supabase Postgres
-- Location: scripts/db_hardening/harden_all.sql
-- WARNING: This script is intended to be reviewed before execution. By default it prints recommended SQL actions
-- and only executes changes when you set perform_changes := true in the DO blocks below.
--
-- Edit the perform_changes variable in each DO block to true to make the changes. Alternatively, copy the
-- generated RAISE NOTICE output and run the statements yourself after review.

-- Helpful: run with psql as: psql <CONN_STRING> -f scripts/db_hardening/harden_all.sql
-- Or run the sections you want interactively.

\set ON_ERROR_STOP on

-- =========================
-- STEP 1 — SECURITY DEFINER
-- =========================
-- Find all security-definer functions and produce REVOKE / ALTER statements.
DO $$
DECLARE
  r RECORD;
  perform_changes BOOLEAN := false; -- CHANGE to true to apply
  revoke_sql TEXT;
  alter_invoker_sql TEXT;
  set_search_path_sql TEXT;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema, p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.prosecdef = true
  LOOP
    revoke_sql := format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon;', r.schema, r.name, r.args);
    alter_invoker_sql := format('ALTER FUNCTION %I.%I(%s) SECURITY INVOKER;', r.schema, r.name, r.args);
    set_search_path_sql := format('ALTER FUNCTION %I.%I(%s) SET search_path = public;', r.schema, r.name, r.args);

    RAISE NOTICE 'SECDEF FOUND: %', r;
    RAISE NOTICE '%', revoke_sql;
    RAISE NOTICE '%', alter_invoker_sql;
    RAISE NOTICE '%', set_search_path_sql;

    IF perform_changes THEN
      EXECUTE revoke_sql;
      EXECUTE alter_invoker_sql;
      EXECUTE set_search_path_sql;
      RAISE NOTICE 'Applied for %I.%I(%s)', r.schema, r.name, r.args;
    END IF;
  END LOOP;
END$$;

-- =========================
-- STEP 2 — RLS PERFORMANCE
-- =========================
-- Find policies mentioning auth.uid(), auth.role(), current_setting() and produce ALTER POLICY statements
-- to replace with the safer (select auth.uid()) style to avoid repeated evaluation in per-row checks.
DO $$
DECLARE
  p RECORD;
  perform_changes BOOLEAN := false; -- CHANGE to true to apply
  new_qual TEXT;
  new_with_check TEXT;
  alter_sql TEXT;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_catalog.pg_policies
    WHERE (qual IS NOT NULL AND (qual ILIKE '%auth.uid()%'
                                 OR qual ILIKE '%auth.role()%'
                                 OR qual ILIKE '%current_setting(%'))
       OR (with_check IS NOT NULL AND (with_check ILIKE '%auth.uid()%'
                                 OR with_check ILIKE '%auth.role()%'
                                 OR with_check ILIKE '%current_setting(%')))
  LOOP
    new_qual := NULL;
    new_with_check := NULL;
    IF p.qual IS NOT NULL THEN
      new_qual := rtrim(replace(replace(replace(p.qual, 'auth.uid()', '(select auth.uid())'), 'auth.role()', '(select auth.role())'), 'current_setting(', '(select current_setting('));
    END IF;
    IF p.with_check IS NOT NULL THEN
      new_with_check := rtrim(replace(replace(replace(p.with_check, 'auth.uid()', '(select auth.uid())'), 'auth.role()', '(select auth.role())'), 'current_setting(', '(select current_setting('));
    END IF;

    RAISE NOTICE 'POLICY: %.% on %', p.schemaname, p.tablename, p.policyname;
    IF new_qual IS NOT NULL THEN
      alter_sql := format('ALTER POLICY %I ON %I.%I USING (%s);', p.policyname, p.schemaname, p.tablename, new_qual);
      RAISE NOTICE '%', alter_sql;
      IF perform_changes THEN
        EXECUTE alter_sql;
        RAISE NOTICE 'Applied ALTER POLICY (qual) for %', p.policyname;
      END IF;
    END IF;
    IF new_with_check IS NOT NULL THEN
      alter_sql := format('ALTER POLICY %I ON %I.%I WITH CHECK (%s);', p.policyname, p.schemaname, p.tablename, new_with_check);
      RAISE NOTICE '%', alter_sql;
      IF perform_changes THEN
        EXECUTE alter_sql;
        RAISE NOTICE 'Applied ALTER POLICY (with_check) for %', p.policyname;
      END IF;
    END IF;
  END LOOP;
END$$;

-- =========================
-- STEP 3 — CONSOLIDATE POLICIES
-- =========================
-- This operation is potentially destructive (merging policies). The script below prints tables with multiple
-- permissive policies for the same command (SELECT/INSERT/UPDATE/DELETE). It does NOT auto-merge; you must
-- review and create a unified policy manually. The script prints suggested merged policy SQL that includes
-- platform_admin bypass placeholder.

-- List candidate tables with multiple permissive policies for the same cmd
SELECT schemaname, tablename, cmd, array_agg(policyname) AS policies, count(*) AS cnt
FROM pg_catalog.pg_policies
WHERE permissive = true
GROUP BY schemaname, tablename, cmd
HAVING count(*) > 1
ORDER BY cnt DESC;

-- Example generator: for each table with multiple SELECT policies, the DBA should review and merge them.
-- The following query prints suggested CREATE POLICY statements (manual review required).
SELECT format('-- REVIEW MERGE for %I.%I (cmd=%s): policies=%s', schemaname, tablename, cmd, array_to_string(array_agg(policyname), ',')) AS note,
       format('-- Example unified policy (manual edit and apply):\n-- DROP POLICY %s ON %I.%I;\n-- DROP POLICY %s ON %I.%I;\n-- CREATE POLICY unified_%s_policy ON %I.%I FOR %s USING ( (existing_member_logic) OR ((select auth.jwt() ->> ''role'') = ''platform_admin'') );',
              (array_agg(policyname))[1], schemaname, tablename,
              (array_agg(policyname))[2], schemaname, tablename,
              cmd, schemaname, tablename, cmd)
FROM pg_catalog.pg_policies
WHERE permissive = true
GROUP BY schemaname, tablename, cmd
HAVING count(*) > 1;

-- =========================
-- STEP 4 — PLATFORM ADMIN GLOBAL ACCESS
-- =========================
-- Add platform_admin bypass to policies that currently restrict by org_id only.
DO $$
DECLARE
  p RECORD;
  perform_changes BOOLEAN := false; -- set to true to apply
  new_qual TEXT;
  new_with_check TEXT;
  alter_sql TEXT;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_catalog.pg_policies
    WHERE (coalesce(qual,'') ILIKE '%org_id%'
       OR coalesce(with_check,'') ILIKE '%org_id%')
  LOOP
    new_qual := p.qual;
    new_with_check := p.with_check;
    -- skip if already contains platform_admin check
    IF coalesce(p.qual,'') ILIKE '%platform_admin%' THEN
      RAISE NOTICE 'Skipping % due to existing platform_admin condition', p.policyname;
      CONTINUE;
    END IF;
    IF new_qual IS NOT NULL AND new_qual <> '' THEN
      new_qual := format('(%s) OR ((select auth.jwt() ->> ''role'') = ''platform_admin'')', new_qual);
      alter_sql := format('ALTER POLICY %I ON %I.%I USING (%s);', p.policyname, p.schemaname, p.tablename, new_qual);
      RAISE NOTICE '%', alter_sql;
      IF perform_changes THEN
        EXECUTE alter_sql;
        RAISE NOTICE 'Applied platform_admin to qual for %', p.policyname;
      END IF;
    END IF;

    IF new_with_check IS NOT NULL AND new_with_check <> '' THEN
      new_with_check := format('(%s) OR ((select auth.jwt() ->> ''role'') = ''platform_admin'')', new_with_check);
      alter_sql := format('ALTER POLICY %I ON %I.%I WITH CHECK (%s);', p.policyname, p.schemaname, p.tablename, new_with_check);
      RAISE NOTICE '%', alter_sql;
      IF perform_changes THEN
        EXECUTE alter_sql;
        RAISE NOTICE 'Applied platform_admin to with_check for %', p.policyname;
      END IF;
    END IF;
  END LOOP;
END$$;

-- =========================
-- STEP 5 — RLS ENABLED WITH NO POLICY
-- =========================
-- Find tables with rls enabled but zero policies
SELECT n.nspname AS schema, c.relname AS table
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relrowsecurity = true
  AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies p WHERE p.schemaname = n.nspname AND p.tablename = c.relname);

-- For safety, we'll print commands to create a deny_all policy per-table. Review before applying.
DO $$
DECLARE
  r RECORD;
  perform_changes BOOLEAN := false; -- set true to apply
  create_sql TEXT;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema, c.relname AS table
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE c.relrowsecurity = true
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies p WHERE p.schemaname = n.nspname AND p.tablename = c.relname)
  LOOP
    create_sql := format('CREATE POLICY deny_all ON %I.%I FOR ALL USING (false);', r.schema, r.table);
    RAISE NOTICE '%', create_sql;
    IF perform_changes THEN
      EXECUTE create_sql;
      RAISE NOTICE 'Created deny_all for %I.%I', r.schema, r.table;
    END IF;
  END LOOP;
END$$;

-- =========================
-- STEP 6 — REMOVE UNUSED INDEXES (SAFE)
-- =========================
-- List indexes with idx_scan = 0 (no scans recorded). Review carefully before dropping.
SELECT indexrelid::regclass AS index_name, relname AS table_name, idx_scan
FROM pg_stat_user_indexes
JOIN pg_class ON pg_class.oid = pg_stat_user_indexes.relid
WHERE idx_scan = 0
ORDER BY table_name;

-- Print DROP INDEX commands but do not execute automatically
DO $$
DECLARE r RECORD;
    perform_changes BOOLEAN := false; -- set true to actually drop
    drop_sql TEXT;
BEGIN
  FOR r IN
    SELECT indexrelid::regclass AS index_name
    FROM pg_stat_user_indexes
    JOIN pg_class ON pg_class.oid = pg_stat_user_indexes.relid
    WHERE idx_scan = 0
  LOOP
    drop_sql := format('DROP INDEX IF EXISTS %s;', r.index_name::text);
    RAISE NOTICE '%', drop_sql;
    IF perform_changes THEN
      EXECUTE drop_sql;
      RAISE NOTICE 'Dropped %', r.index_name;
    END IF;
  END LOOP;
END$$;

-- =========================
-- STEP 7 — ADD MISSING HIGH-VALUE INDEXES
-- =========================
-- Create commonly useful indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_courses_org_id ON public.courses(org_id);
CREATE INDEX IF NOT EXISTS idx_assignments_user_id ON public.assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON public.organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON public.organization_memberships(org_id);

-- =========================
-- STEP 8 — VERIFY RLS + AUTH FLOW
-- =========================
-- The queries below assume you will exercise them through the same auth layer your app uses (eg, via PostgREST/REST with JWT headers).
-- Example verification commands (use curl with Authorization: Bearer <JWT>):
-- 1) Platform admin (JWT role=platform_admin): SELECT * FROM public.courses;
-- 2) Org user (JWT with org_id claim): SELECT * FROM public.courses;
-- 3) Unauthorized user (no JWT or wrong claims): should be denied.

-- You can also inspect policies after changes
SELECT * FROM pg_catalog.pg_policies ORDER BY schemaname, tablename, policyname;

-- =========================
-- STEP 9 — FINAL SAFETY CHECK
-- =========================
-- Validate duplicates and check that policies include platform_admin logic (manual review step)
SELECT schemaname, tablename, cmd, policyname, qual, with_check
FROM pg_catalog.pg_policies
ORDER BY schemaname, tablename, cmd, policyname;

-- =========================
-- NOTES / NEXT STEPS
-- =========================
-- After running the above in preview mode (default), change desired DO blocks perform_changes := true and re-run or copy/paste the generated statements and apply them.
-- Be careful when dropping indexes or merging policies. Always take a DB backup or snapshot first.
-- For Step 2 replacement of auth.uid() and auth.role(), complex expressions or variants may require manual review. The script attempts simple textual replacements but may not be correct in all contexts.

-- End of script
