-- Migration: Refine RLS policies for listed tables (more specific rules)
-- Generated: 2026-05-02 12:00:01
-- Idempotent: checks for existing policies before creating them.
-- Behavior:
--  - If a table has an org column (org_id or organization_id), create:
--      * policy 'org_select' for SELECT to authenticated when user is a member of the org
--      * policy 'org_manage' for INSERT/UPDATE/DELETE to authenticated when user is owner/admin/editor
--  - If a table has owner columns (owner_id, created_by, user_id), create 'owner_all' FOR ALL to owner
--  - If a table name looks like an audit/log (contains 'audit' or 'log' or is in a small blacklist), create 'deny_authenticated' that blocks authenticated clients
--  - Otherwise create a conservative authenticated SELECT policy only

DO $$
DECLARE
  tbl text;
  relkind char;
  has_org boolean;
  has_owner boolean;
  org_cols text[];
  owner_cols text[];
  org_expr text;
  owner_expr text;
  policy_sql text;
  is_audit boolean;
  tables text[] := ARRAY[
    '_backup_org_onboarding_progress_vw',
    '_policy_backup',
    'admin_users',
    'analytics_events',
    'audit_logs',
    'auth_audit',
    'certificates',
    'course_assignments',
    'course_engagement',
    'course_media_assets',
    'documents',
    'email_logs',
    'hdi_assessment_results',
    'idempotency_keys',
    'learner_journeys',
    'lesson_reflections',
    'lessons',
    'message_logs',
    'modules',
    'notifications',
    'org_activation_events',
    'org_activation_steps',
    'org_engagement_metrics',
    'org_invites',
    'org_workspace_action_items',
    'org_workspace_session_notes',
    'org_workspace_strategic_plans',
    'organization_branding',
    'organization_contacts',
    'organization_members',
    'organization_messages',
    'organization_profiles',
    'quiz_attempts',
    'rls_audit_log',
    'survey_assignments',
    'survey_responses',
    'team_huddle_comments',
    'team_huddle_post_reactions',
    'team_huddle_posts',
    'team_huddle_reactions',
    'team_huddle_reports',
    'user_achievements',
    'user_activity_log',
    'user_gamification_profile',
    'user_lesson_progress'
  ];

BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- check object exists and is a regular table
    SELECT c.relkind INTO relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = tbl;

    IF NOT FOUND THEN
      RAISE NOTICE 'Skipping % because it does not exist in public schema', tbl;
      CONTINUE;
    END IF;

    IF relkind <> 'r' THEN
      RAISE NOTICE 'Skipping % because it is not a table (relkind=%). Manual review may be needed.', tbl, relkind;
      CONTINUE;
    END IF;

    has_org := EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = tbl AND c.column_name IN ('org_id', 'organization_id')
    );

    has_owner := EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = tbl AND c.column_name IN ('owner_id', 'created_by', 'user_id')
    );

    is_audit := tbl ILIKE '%audit%' OR tbl ILIKE '%log%' OR tbl = 'analytics_events' OR tbl = 'idempotency_keys';

    IF is_audit THEN
      -- deny authenticated users; service_role and server-side will still work (service_role bypasses RLS)
      IF NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = tbl AND p.policyname = 'deny_authenticated') THEN
        EXECUTE format('CREATE POLICY deny_authenticated ON public.%I FOR ALL TO authenticated USING (false);', tbl);
        RAISE NOTICE 'Created deny_authenticated policy on %', tbl;
      ELSE
        RAISE NOTICE 'deny_authenticated already exists on %', tbl;
      END IF;

      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
      RAISE NOTICE 'Enabled RLS on %', tbl;
      CONTINUE;
    END IF;

    IF has_org THEN
      -- Build a coalesce expression using only existing org columns for this table
      SELECT array_agg(column_name) INTO org_cols
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = tbl AND c.column_name IN ('org_id', 'organization_id');

      org_expr := NULL;
      IF org_cols IS NOT NULL THEN
        IF array_length(org_cols,1) = 2 THEN
          org_expr := '(coalesce((org_id)::text, (organization_id)::text))';
        ELSE
          -- only one of the org columns exists
          IF org_cols[1] = 'org_id' THEN
            org_expr := '((org_id)::text)';
          ELSE
            org_expr := '((organization_id)::text)';
          END IF;
        END IF;
      ELSE
        org_expr := 'NULL';
      END IF;
      -- org-based SELECT policy
      IF NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = tbl AND p.policyname = 'org_select') THEN
  policy_sql := 'CREATE POLICY org_select ON public.' || quote_ident(tbl) || ' FOR SELECT TO authenticated USING (' ||
    ' EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.user_id = (select auth.uid()) AND (m.organization_id)::text = ' || org_expr || ')' ||
    ' );';
  RAISE NOTICE 'Policy SQL for org_select on %: %', tbl, policy_sql;
  EXECUTE policy_sql;
        RAISE NOTICE 'Created org_select on %', tbl;
      ELSE
        RAISE NOTICE 'org_select already exists on %', tbl;
      END IF;

      -- org-based manage policy (insert/update/delete) requires role owner/admin/editor
      -- Create separate policies for INSERT, UPDATE, DELETE since Postgres does not accept a combined event list
      IF NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = tbl AND p.policyname = 'org_manage_insert') THEN
        policy_sql := 'CREATE POLICY org_manage_insert ON public.' || quote_ident(tbl) || ' FOR INSERT TO authenticated WITH CHECK (' ||
          ' EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.user_id = (select auth.uid())' ||
          ' AND lower(coalesce(m.role, ''member'')) = ANY (ARRAY[''owner'',''admin'',''editor''])' ||
          ' AND (m.organization_id)::text = ' || org_expr || ' )' ||
          ' );';
        RAISE NOTICE 'Policy SQL for org_manage_insert on %: %', tbl, policy_sql;
        EXECUTE policy_sql;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = tbl AND p.policyname = 'org_manage_update') THEN
        policy_sql := 'CREATE POLICY org_manage_update ON public.' || quote_ident(tbl) || ' FOR UPDATE TO authenticated USING (' ||
          ' EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.user_id = (select auth.uid())' ||
          ' AND lower(coalesce(m.role, ''member'')) = ANY (ARRAY[''owner'',''admin'',''editor''])' ||
          ' AND (m.organization_id)::text = ' || org_expr || ' )' ||
          ' );';
        RAISE NOTICE 'Policy SQL for org_manage_update on %: %', tbl, policy_sql;
        EXECUTE policy_sql;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = tbl AND p.policyname = 'org_manage_delete') THEN
        policy_sql := 'CREATE POLICY org_manage_delete ON public.' || quote_ident(tbl) || ' FOR DELETE TO authenticated USING (' ||
          ' EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.user_id = (select auth.uid())' ||
          ' AND lower(coalesce(m.role, ''member'')) = ANY (ARRAY[''owner'',''admin'',''editor''])' ||
          ' AND (m.organization_id)::text = ' || org_expr || ' )' ||
          ' );';
        RAISE NOTICE 'Policy SQL for org_manage_delete on %: %', tbl, policy_sql;
        EXECUTE policy_sql;
      END IF;

      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
      RAISE NOTICE 'Enabled RLS on %', tbl;

    ELSIF has_owner THEN
      -- Build a coalesce expression using only existing owner columns for this table
      SELECT array_agg(column_name) INTO owner_cols
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = tbl AND c.column_name IN ('owner_id', 'created_by', 'user_id');

      owner_expr := NULL;
      IF owner_cols IS NOT NULL THEN
        IF array_length(owner_cols,1) > 1 THEN
          owner_expr := '(coalesce(' || (
            SELECT string_agg(format('(%I)::text', col), ', ')
            FROM unnest(owner_cols) AS col
          ) || '))';
        ELSE
          -- single owner column
          IF owner_cols[1] = 'owner_id' THEN
            owner_expr := '((owner_id)::text)';
          ELSIF owner_cols[1] = 'created_by' THEN
            owner_expr := '((created_by)::text)';
          ELSE
            owner_expr := '((user_id)::text)';
          END IF;
        END IF;
      ELSE
        owner_expr := 'NULL';
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = tbl AND p.policyname = 'owner_all') THEN
  -- Use constructed owner_expr in the policy
  EXECUTE 'CREATE POLICY owner_all ON public.' || quote_ident(tbl) || ' FOR ALL TO authenticated USING ((select auth.uid())::text = ' || owner_expr || ') WITH CHECK ((select auth.uid())::text = ' || owner_expr || ');';
        RAISE NOTICE 'Created owner_all on %', tbl;
      ELSE
        RAISE NOTICE 'owner_all already exists on %', tbl;
      END IF;

      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
      RAISE NOTICE 'Enabled RLS on %', tbl;

    ELSE
      -- fallback: authenticated SELECT only
      IF NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = tbl AND p.policyname = 'authenticated_select') THEN
        EXECUTE format('CREATE POLICY authenticated_select ON public.%I FOR SELECT TO authenticated USING (true);', tbl);
        RAISE NOTICE 'Created authenticated_select (fallback) on %', tbl;
      ELSE
        RAISE NOTICE 'authenticated_select already exists on %', tbl;
      END IF;

      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
      RAISE NOTICE 'Enabled RLS on %', tbl;
    END IF;

  END LOOP;
END
$$;

-- NOTES:
-- - This migration prefers precise org/owner rules where possible and denies client access to audit/log tables.
-- - It assumes a public.organization_memberships table with user_id, organization_id, role.
-- - Review the generated policies after running; replace broad checks (e.g., any member allowed to SELECT) with narrower business rules where appropriate.
-- - Test in staging prior to production.
