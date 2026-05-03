-- Consolidate generated RLS policies that triggered Supabase Advisor warnings.
-- This removes broad duplicate policies, recreates action-specific policies with
-- initplan-safe auth calls, and table-qualifies organization columns so nested
-- membership subqueries compare against the protected row.

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
  restricted_tables text[] := ARRAY[
    '_policy_backup',
    'analytics_events',
    'audit_logs',
    'auth_audit',
    'email_logs',
    'idempotency_keys',
    'message_logs',
    'rls_audit_log',
    'user_activity_log'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    SELECT c.relkind
      INTO relkind
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = tbl;

    IF NOT FOUND OR relkind <> 'r' THEN
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS org_members_access ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS owner_can_manage ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS owner_all ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS authenticated_select ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS authenticated_select_all ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS deny_authenticated ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS org_select ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS org_manage_insert ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS org_manage_update ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS org_manage_delete ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', tbl || '_service_only', tbl);

    IF tbl = ANY (restricted_tables) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);',
        tbl || '_service_only',
        tbl
      );
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
      CONTINUE;
    END IF;

    has_org := EXISTS (
      SELECT 1
        FROM information_schema.columns c
       WHERE c.table_schema = 'public'
         AND c.table_name = tbl
         AND c.column_name IN ('org_id', 'organization_id', 'organizationid')
    );

    has_owner := EXISTS (
      SELECT 1
        FROM information_schema.columns c
       WHERE c.table_schema = 'public'
         AND c.table_name = tbl
         AND c.column_name IN ('owner_id', 'created_by', 'user_id')
    );

    IF has_org THEN
      SELECT array_agg(column_name ORDER BY ordinal_position)
        INTO org_cols
        FROM information_schema.columns c
       WHERE c.table_schema = 'public'
         AND c.table_name = tbl
         AND c.column_name IN ('org_id', 'organization_id', 'organizationid');

      IF array_length(org_cols, 1) > 1 THEN
        SELECT 'coalesce(' || string_agg(format('%I.%I::text', tbl, col), ', ') || ')'
          INTO org_expr
          FROM unnest(org_cols) AS col;
      ELSE
        org_expr := format('%I.%I::text', tbl, org_cols[1]);
      END IF;

      policy_sql := 'CREATE POLICY org_select ON public.' || quote_ident(tbl) ||
        ' FOR SELECT TO authenticated USING (' ||
        'EXISTS (SELECT 1 FROM public.organization_memberships m ' ||
        'WHERE m.user_id = (select auth.uid()) ' ||
        'AND COALESCE(m.is_active, true) ' ||
        'AND COALESCE(m.status, ''active'') = ''active'' ' ||
        'AND m.organization_id::text = ' || org_expr || '));';
      EXECUTE policy_sql;

      policy_sql := 'CREATE POLICY org_manage_insert ON public.' || quote_ident(tbl) ||
        ' FOR INSERT TO authenticated WITH CHECK (' ||
        'EXISTS (SELECT 1 FROM public.organization_memberships m ' ||
        'WHERE m.user_id = (select auth.uid()) ' ||
        'AND COALESCE(m.is_active, true) ' ||
        'AND COALESCE(m.status, ''active'') = ''active'' ' ||
        'AND lower(COALESCE(m.role, ''member'')) = ANY (ARRAY[''owner'',''admin'',''editor'']) ' ||
        'AND m.organization_id::text = ' || org_expr || '));';
      EXECUTE policy_sql;

      policy_sql := 'CREATE POLICY org_manage_update ON public.' || quote_ident(tbl) ||
        ' FOR UPDATE TO authenticated USING (' ||
        'EXISTS (SELECT 1 FROM public.organization_memberships m ' ||
        'WHERE m.user_id = (select auth.uid()) ' ||
        'AND COALESCE(m.is_active, true) ' ||
        'AND COALESCE(m.status, ''active'') = ''active'' ' ||
        'AND lower(COALESCE(m.role, ''member'')) = ANY (ARRAY[''owner'',''admin'',''editor'']) ' ||
        'AND m.organization_id::text = ' || org_expr || ')) WITH CHECK (' ||
        'EXISTS (SELECT 1 FROM public.organization_memberships m ' ||
        'WHERE m.user_id = (select auth.uid()) ' ||
        'AND COALESCE(m.is_active, true) ' ||
        'AND COALESCE(m.status, ''active'') = ''active'' ' ||
        'AND lower(COALESCE(m.role, ''member'')) = ANY (ARRAY[''owner'',''admin'',''editor'']) ' ||
        'AND m.organization_id::text = ' || org_expr || '));';
      EXECUTE policy_sql;

      policy_sql := 'CREATE POLICY org_manage_delete ON public.' || quote_ident(tbl) ||
        ' FOR DELETE TO authenticated USING (' ||
        'EXISTS (SELECT 1 FROM public.organization_memberships m ' ||
        'WHERE m.user_id = (select auth.uid()) ' ||
        'AND COALESCE(m.is_active, true) ' ||
        'AND COALESCE(m.status, ''active'') = ''active'' ' ||
        'AND lower(COALESCE(m.role, ''member'')) = ANY (ARRAY[''owner'',''admin'',''editor'']) ' ||
        'AND m.organization_id::text = ' || org_expr || '));';
      EXECUTE policy_sql;

      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
      CONTINUE;
    END IF;

    IF has_owner THEN
      SELECT array_agg(column_name ORDER BY ordinal_position)
        INTO owner_cols
        FROM information_schema.columns c
       WHERE c.table_schema = 'public'
         AND c.table_name = tbl
         AND c.column_name IN ('owner_id', 'created_by', 'user_id');

      IF array_length(owner_cols, 1) > 1 THEN
        SELECT 'coalesce(' || string_agg(format('%I.%I::text', tbl, col), ', ') || ')'
          INTO owner_expr
          FROM unnest(owner_cols) AS col;
      ELSE
        owner_expr := format('%I.%I::text', tbl, owner_cols[1]);
      END IF;

      policy_sql := 'CREATE POLICY owner_all ON public.' || quote_ident(tbl) ||
        ' FOR ALL TO authenticated USING ((select auth.uid())::text = ' || owner_expr ||
        ') WITH CHECK ((select auth.uid())::text = ' || owner_expr || ');';
      EXECUTE policy_sql;

      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
      CONTINUE;
    END IF;

    EXECUTE format(
      'CREATE POLICY authenticated_select ON public.%I FOR SELECT TO authenticated USING (true);',
      tbl
    );
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
  END LOOP;
END
$$;
