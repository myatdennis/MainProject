-- Migration: Replace existing policies that reference auth.uid() with initplan-safe forms
-- Generated: 2026-05-04
-- Purpose: For tables that had policies referencing auth.uid(), drop and recreate those policies
-- using the initialization form (select auth.uid()). This is idempotent and safe to run repeatedly.

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
    -- ensure table exists and is a regular table
    SELECT c.relkind INTO relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = tbl;

    IF NOT FOUND THEN
      RAISE NOTICE 'Skipping % because it does not exist', tbl;
      CONTINUE;
    END IF;

    IF relkind <> 'r' THEN
      RAISE NOTICE 'Skipping % because relkind=% (not a regular table)', tbl, relkind;
      CONTINUE;
    END IF;

    -- detect org and owner columns
    has_org := EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = tbl AND c.column_name IN ('org_id', 'organization_id', 'organizationid')
    );

    has_owner := EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = tbl AND c.column_name IN ('owner_id', 'created_by', 'user_id')
    );

    -- Build expressions similar to the original migration so recreated policies match expected semantics
    IF has_org THEN
      SELECT array_agg(column_name) INTO org_cols
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = tbl AND c.column_name IN ('org_id', 'organization_id', 'organizationid');

      IF org_cols IS NOT NULL THEN
        IF array_length(org_cols,1) > 1 THEN
          org_expr := '(coalesce(' || (
            SELECT string_agg(format('(%I)::text', col), ', ')
            FROM unnest(org_cols) AS col
          ) || '))';
        ELSE
          IF org_cols[1] = 'org_id' THEN
            org_expr := '((org_id)::text)';
          ELSIF org_cols[1] = 'organization_id' THEN
            org_expr := '((organization_id)::text)';
          ELSE
            org_expr := '((organizationid)::text)';
          END IF;
        END IF;
      ELSE
        org_expr := 'NULL';
      END IF;

      -- Replace/create org_select
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'org_select', tbl);
      policy_sql := 'CREATE POLICY org_select ON public.' || quote_ident(tbl) || ' FOR SELECT TO authenticated USING (' ||
        ' EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.user_id = (select auth.uid()) AND (m.organization_id)::text = ' || org_expr || ')' ||
        ' );';
      RAISE NOTICE 'Recreating org_select on %: %', tbl, policy_sql;
      EXECUTE policy_sql;

      -- Replace/create org_manage_insert/update/delete
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'org_manage_insert', tbl);
      policy_sql := 'CREATE POLICY org_manage_insert ON public.' || quote_ident(tbl) || ' FOR INSERT TO authenticated WITH CHECK (' ||
          ' EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.user_id = (select auth.uid())' ||
          ' AND lower(coalesce(m.role, ''member'')) = ANY (ARRAY[''owner'',''admin'',''editor''])' ||
          ' AND (m.organization_id)::text = ' || org_expr || ' )' ||
          ' );';
      RAISE NOTICE 'Recreating org_manage_insert on %', tbl;
      EXECUTE policy_sql;

      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'org_manage_update', tbl);
      policy_sql := 'CREATE POLICY org_manage_update ON public.' || quote_ident(tbl) || ' FOR UPDATE TO authenticated USING (' ||
          ' EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.user_id = (select auth.uid())' ||
          ' AND lower(coalesce(m.role, ''member'')) = ANY (ARRAY[''owner'',''admin'',''editor''])' ||
          ' AND (m.organization_id)::text = ' || org_expr || ' )' ||
          ' );';
      RAISE NOTICE 'Recreating org_manage_update on %', tbl;
      EXECUTE policy_sql;

      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'org_manage_delete', tbl);
      policy_sql := 'CREATE POLICY org_manage_delete ON public.' || quote_ident(tbl) || ' FOR DELETE TO authenticated USING (' ||
          ' EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.user_id = (select auth.uid())' ||
          ' AND lower(coalesce(m.role, ''member'')) = ANY (ARRAY[''owner'',''admin'',''editor''])' ||
          ' AND (m.organization_id)::text = ' || org_expr || ' )' ||
          ' );';
      RAISE NOTICE 'Recreating org_manage_delete on %', tbl;
      EXECUTE policy_sql;

    END IF; -- has_org

    IF has_owner THEN
      SELECT array_agg(column_name) INTO owner_cols
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = tbl AND c.column_name IN ('owner_id', 'created_by', 'user_id');

      IF owner_cols IS NOT NULL THEN
        IF array_length(owner_cols,1) > 1 THEN
          owner_expr := '(coalesce(' || (
            SELECT string_agg(format('(%I)::text', col), ', ')
            FROM unnest(owner_cols) AS col
          ) || '))';
        ELSE
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

      -- Recreate owner_all
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'owner_all', tbl);
      policy_sql := 'CREATE POLICY owner_all ON public.' || quote_ident(tbl) || ' FOR ALL TO authenticated USING ((select auth.uid())::text = ' || owner_expr || ') WITH CHECK ((select auth.uid())::text = ' || owner_expr || ');';
      RAISE NOTICE 'Recreating owner_all on %: %', tbl, policy_sql;
      EXECUTE policy_sql;

    END IF;

    -- For audit/log tables, ensure deny_authenticated exists (recreate to be safe)
    IF tbl ILIKE '%audit%' OR tbl ILIKE '%log%' OR tbl = 'analytics_events' OR tbl = 'idempotency_keys' THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'deny_authenticated', tbl);
      EXECUTE format('CREATE POLICY deny_authenticated ON public.%I FOR ALL TO authenticated USING (false);', tbl);
      RAISE NOTICE 'Ensured deny_authenticated on %', tbl;
    END IF;

  END LOOP;
END
$$;

-- NOTES:
-- - This migration forcibly replaces a set of commonly-created policies so their expressions use
--   (select auth.uid()) instead of auth.uid(), addressing planner initplan warnings.
-- - It is idempotent: DROP POLICY IF EXISTS + CREATE POLICY will result in the same final state when re-run.
-- - Dropping and recreating policies briefly changes RLS rules; run this during a maintenance window if
--   you are concerned about transient access changes.
