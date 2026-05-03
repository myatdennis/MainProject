-- Migration: Add targeted RLS policies for tables previously flagged as "RLS enabled but no policy"
-- Generated: 2026-05-02 12:00:00
-- This migration is idempotent: it only creates policies when the table and target columns exist
-- and will ENABLE ROW LEVEL SECURITY after creating policies. It will skip non-table objects (views)
-- and create a conservative SELECT-only policy when no owner/org columns exist, to restore read access.

DO $$
DECLARE
  tbl text;
  relkind char;
  has_org boolean;
  has_owner boolean;
  policy_org text := 'org_members_access';
  policy_owner text := 'owner_can_manage';
  policy_select text := 'authenticated_select_all';
  policy_sql text;
  org_cols text[];
  org_expr text;
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

    -- detect candidate columns
    has_org := EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = tbl AND c.column_name IN ('org_id', 'organization_id', 'organizationid')
    );

    has_owner := EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = tbl AND c.column_name IN ('owner_id', 'created_by', 'user_id')
    );

    IF has_org THEN
      -- Build a dynamic org expression using existing org columns for this table
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

      IF NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = tbl AND p.policyname = policy_org) THEN
        policy_sql := 'CREATE POLICY ' || quote_ident(policy_org) || ' ON public.' || quote_ident(tbl) ||
                      ' FOR ALL TO authenticated USING ( EXISTS ( SELECT 1 FROM public.organization_memberships m WHERE m.user_id = (select auth.uid())' ||
                      ' AND lower(coalesce(m.role, ''member'')) = ANY (ARRAY[''owner'',''admin'',''editor''])' ||
                      ' AND (m.organization_id)::text = ' || org_expr || ' ) ) WITH CHECK ( EXISTS ( SELECT 1 FROM public.organization_memberships m WHERE m.user_id = (select auth.uid())' ||
                      ' AND lower(coalesce(m.role, ''member'')) = ANY (ARRAY[''owner'',''admin'',''editor''])' ||
                      ' AND (m.organization_id)::text = ' || org_expr || ' ) );';
        RAISE NOTICE 'Policy SQL for org-members on %: %', tbl, policy_sql;
        EXECUTE policy_sql;
        RAISE NOTICE 'Created org-members policy on %', tbl;
      ELSE
        RAISE NOTICE 'Org-members policy already exists on %', tbl;
      END IF;

      -- Ensure RLS is enabled
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
      RAISE NOTICE 'Enabled RLS on %', tbl;

    ELSIF has_owner THEN
      -- Create an ownership-based policy that allows row owner to manage rows
                            -- Build dynamic owner expression (only include columns that exist)
                            DECLARE owner_cols text[];
                            owner_expr text;
                            policy_sql text;
                            BEGIN
          SELECT array_agg(column_name) INTO owner_cols
          FROM information_schema.columns c
          WHERE c.table_schema = 'public' AND c.table_name = tbl AND c.column_name IN ('owner_id', 'created_by', 'user_id');

          IF owner_cols IS NOT NULL THEN
            owner_expr := '(coalesce(' || (
              SELECT string_agg(format('(%I)::text', col), ', ')
              FROM unnest(owner_cols) AS col
            ) || '))';
          ELSE
            owner_expr := 'NULL';
          END IF;

          IF NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = tbl AND p.policyname = policy_owner) THEN
            -- Construct policy SQL using only existing owner columns
            policy_sql := 'CREATE POLICY ' || quote_ident(policy_owner) || ' ON public.' || quote_ident(tbl) ||
                          ' FOR ALL TO authenticated USING ((select auth.uid())::text = ' || owner_expr || ') WITH CHECK ((select auth.uid())::text = ' || owner_expr || ');';
            RAISE NOTICE 'Owner policy SQL for %: %', tbl, policy_sql;
            EXECUTE policy_sql;
            RAISE NOTICE 'Created owner-based policy on %', tbl;
          ELSE
            RAISE NOTICE 'Owner-based policy already exists on %', tbl;
          END IF;
        END;

      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
      RAISE NOTICE 'Enabled RLS on %', tbl;

    ELSE
      -- No obvious org/owner column to base policy on. Create a conservative authenticated-SELECT policy
      IF NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = tbl AND p.policyname = policy_select) THEN
        EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true);', policy_select, tbl);
        RAISE NOTICE 'Created SELECT-only authenticated policy on % (no org/owner column found). Please review for tighter rules.', tbl;
      ELSE
        RAISE NOTICE 'SELECT-only policy already exists on %', tbl;
      END IF;

      -- Enable RLS so that the newly created SELECT policy takes effect
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
      RAISE NOTICE 'Enabled RLS on %', tbl;
    END IF;

  END LOOP;
END
$$;

-- NOTES:
-- - The org-membership policy assumes a table `public.organization_memberships` with columns `organization_id`, `user_id`, and `role`.
-- - The owner-based policy uses `owner_id`, `created_by`, or `user_id` when present.
-- - For objects that are not tables (views, etc.) the migration skips them and raises a NOTICE for manual review.
-- - Please review generated policies for each table and replace the permissive SELECT-only fallback with precise rules where needed.
-- - Test in staging before applying to production.
