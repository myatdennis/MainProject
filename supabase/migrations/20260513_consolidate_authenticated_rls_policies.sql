-- Consolidate duplicate permissive authenticated RLS policies.
--
-- Supabase linter 0006 flags tables that have multiple permissive policies
-- for the same role/action. This migration preserves the existing access
-- predicates by OR-ing the current authenticated policies into one policy per
-- table/action, then dropping the original duplicate authenticated policies.
-- service_role policies are intentionally left untouched.

do $$
declare
  target_tables text[] := array[
    'analytics_events',
    'audit_logs',
    'auth_audit',
    'certificates',
    'course_assignments',
    'documents',
    'email_logs',
    'hdi_assessment_results',
    'learner_journeys',
    'lesson_reflections',
    'message_logs',
    'notifications',
    'org_invites',
    'org_workspace_action_items',
    'org_workspace_session_notes',
    'org_workspace_strategic_plans',
    'organization_members',
    'quiz_attempts',
    'survey_responses',
    'team_huddle_comments',
    'team_huddle_post_reactions',
    'team_huddle_posts',
    'team_huddle_reactions',
    'user_achievements',
    'user_activity_log',
    'user_gamification_profile',
    'user_lesson_progress'
  ];
  table_name text;
  policy_name text;
  select_using text;
  insert_check text;
  update_using text;
  update_check text;
  update_has_unchecked_policy boolean;
  delete_using text;
begin
  foreach table_name in array target_tables loop
    if to_regclass(format('public.%I', table_name)) is null then
      continue;
    end if;

    select string_agg(format('(%s)', qual), ' OR ' order by policyname)
      into select_using
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and permissive = 'PERMISSIVE'
        and 'authenticated' = any(roles)
        and cmd in ('ALL', 'SELECT')
        and qual is not null
        and qual <> 'false';

    select string_agg(format('(%s)', with_check), ' OR ' order by policyname)
      into insert_check
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and permissive = 'PERMISSIVE'
        and 'authenticated' = any(roles)
        and cmd in ('ALL', 'INSERT')
        and with_check is not null
        and with_check <> 'false';

    select string_agg(format('(%s)', qual), ' OR ' order by policyname)
      into update_using
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and permissive = 'PERMISSIVE'
        and 'authenticated' = any(roles)
        and cmd in ('ALL', 'UPDATE')
        and qual is not null
        and qual <> 'false';

    select exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and permissive = 'PERMISSIVE'
        and 'authenticated' = any(roles)
        and cmd in ('ALL', 'UPDATE')
        and qual is not null
        and qual <> 'false'
        and with_check is null
    )
      into update_has_unchecked_policy;

    if update_has_unchecked_policy then
      update_check := null;
    else
      select string_agg(format('(%s)', with_check), ' OR ' order by policyname)
        into update_check
        from pg_policies
        where schemaname = 'public'
          and tablename = table_name
          and permissive = 'PERMISSIVE'
          and 'authenticated' = any(roles)
          and cmd in ('ALL', 'UPDATE')
          and with_check is not null
          and with_check <> 'false';
    end if;

    select string_agg(format('(%s)', qual), ' OR ' order by policyname)
      into delete_using
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and permissive = 'PERMISSIVE'
        and 'authenticated' = any(roles)
        and cmd in ('ALL', 'DELETE')
        and qual is not null
        and qual <> 'false';

    for policy_name in
      select p.policyname
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = table_name
        and p.permissive = 'PERMISSIVE'
        and 'authenticated' = any(p.roles)
    loop
      execute format('drop policy if exists %I on public.%I', policy_name, table_name);
    end loop;

    if select_using is not null then
      execute format(
        'create policy %I on public.%I for select to authenticated using (%s)',
        'authenticated_select_consolidated',
        table_name,
        select_using
      );
    end if;

    if insert_check is not null then
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (%s)',
        'authenticated_insert_consolidated',
        table_name,
        insert_check
      );
    end if;

    if update_using is not null then
      if update_check is null then
        execute format(
          'create policy %I on public.%I for update to authenticated using (%s)',
          'authenticated_update_consolidated',
          table_name,
          update_using
        );
      else
        execute format(
          'create policy %I on public.%I for update to authenticated using (%s) with check (%s)',
          'authenticated_update_consolidated',
          table_name,
          update_using,
          update_check
        );
      end if;
    end if;

    if delete_using is not null then
      execute format(
        'create policy %I on public.%I for delete to authenticated using (%s)',
        'authenticated_delete_consolidated',
        table_name,
        delete_using
      );
    end if;
  end loop;
end $$;
