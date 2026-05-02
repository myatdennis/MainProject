-- Resolve Supabase linter warnings:
--   - auth_rls_initplan on unified/service RLS policies
--   - duplicate_index for redundant organization_id and progress indexes
--
-- Policy predicates preserve the existing access model. The only semantic
-- change is wrapping auth/current_setting calls in scalar subqueries so
-- PostgreSQL can init-plan them once per statement instead of per row.

begin;

-- ---------------------------------------------------------------------------
-- Service-role-only policies
-- ---------------------------------------------------------------------------
do $$
declare
  policy_def record;
begin
  for policy_def in
    select *
    from (
      values
        ('analytics_events', 'analytics_events_service_only'),
        ('audit_logs', 'audit_logs_service_only'),
        ('auth_audit', 'auth_audit_service_only'),
        ('certificates', 'certificates_service_only'),
        ('course_engagement', 'course_engagement_service_only'),
        ('email_logs', 'email_logs_service_only'),
        ('idempotency_keys', 'idempotency_keys_service_only'),
        ('message_logs', 'message_logs_service_only'),
        ('org_activation_events', 'org_activation_events_service_only'),
        ('org_activation_steps', 'org_activation_steps_service_only'),
        ('org_engagement_metrics', 'org_engagement_metrics_service_only'),
        ('rls_audit_log', 'rls_audit_log_service_only')
    ) as policies(table_name, policy_name)
  loop
    execute format('drop policy if exists %I on public.%I', policy_def.policy_name, policy_def.table_name);
    execute format(
      'create policy %I on public.%I for all to public using ((select auth.role()) = %L) with check ((select auth.role()) = %L)',
      policy_def.policy_name,
      policy_def.table_name,
      'service_role',
      'service_role'
    );
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Unified select policies
-- ---------------------------------------------------------------------------
drop policy if exists organizations_select_unified on public.organizations;
create policy organizations_select_unified
  on public.organizations
  for select
  to public
  using (
    exists (
      select 1
      from public.organization_memberships as m
      where m.user_id = (select auth.uid())
        and m.organization_id = organizations.id
        and m.status = 'active'
    )
    or ((select auth.jwt()) ->> 'role') = 'platform_admin'
  );

drop policy if exists platform_admin_full_access_users on public.user_profiles;
create policy platform_admin_full_access_users
  on public.user_profiles
  for select
  to public
  using (
    ((((select current_setting('request.jwt.claims', true))::json -> 'app_metadata') ->> 'platform_role') = 'platform_admin')
  );

drop policy if exists organization_memberships_select_unified on public.organization_memberships;
create policy organization_memberships_select_unified
  on public.organization_memberships
  for select
  to public
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.organization_memberships as m
      where m.user_id = (select auth.uid())
        and m.organization_id = organization_memberships.organization_id
        and m.role = any (array['admin'::text, 'owner'::text])
        and m.status = 'active'
    )
    or ((select auth.jwt()) ->> 'role') = 'platform_admin'
  );

drop policy if exists courses_select_unified on public.courses;
create policy courses_select_unified
  on public.courses
  for select
  to public
  using (
    exists (
      select 1
      from public.organization_memberships as m
      where m.user_id = (select auth.uid())
        and m.organization_id = courses.organization_id
        and m.status = 'active'
    )
    or ((select auth.jwt()) ->> 'role') = 'platform_admin'
  );

drop policy if exists organization_courses_select_unified on public.organization_courses;
create policy organization_courses_select_unified
  on public.organization_courses
  for select
  to public
  using (
    exists (
      select 1
      from public.organization_memberships as m
      where m.user_id = (select auth.uid())
        and m.organization_id = organization_courses.organization_id
        and m.status = 'active'
    )
    or ((select auth.jwt()) ->> 'role') = 'platform_admin'
  );

drop policy if exists surveys_select_unified on public.surveys;
create policy surveys_select_unified
  on public.surveys
  for select
  to public
  using (
    exists (
      select 1
      from public.organization_memberships as m
      where m.user_id = (select auth.uid())
        and m.organization_id = surveys.organization_id
        and m.status = 'active'
    )
    or ((select auth.jwt()) ->> 'role') = 'platform_admin'
  );

-- ---------------------------------------------------------------------------
-- Assignment policies
-- ---------------------------------------------------------------------------
drop policy if exists assignments_insert_mya_admin on public.assignments;
create policy assignments_insert_mya_admin
  on public.assignments
  for insert
  to authenticated
  with check (
    ((select auth.jwt()) ->> 'email') = 'mya@the-huddle.co'
    or exists (
      select 1
      from public.organization_memberships as m
      where m.user_id = (select auth.uid())
        and m.organization_id = assignments.organization_id
        and m.role = any (array['admin'::text, 'owner'::text])
        and m.status = 'active'
    )
  );

drop policy if exists assignments_delete_mya_admin on public.assignments;
create policy assignments_delete_mya_admin
  on public.assignments
  for delete
  to authenticated
  using (
    ((select auth.jwt()) ->> 'role') = 'platform_admin'
    or exists (
      select 1
      from public.organization_memberships as m
      where m.user_id = (select auth.uid())
        and m.organization_id = assignments.organization_id
        and m.role = any (array['admin'::text, 'owner'::text])
        and m.status = 'active'
    )
  );

drop policy if exists assignments_select_mya_admin on public.assignments;
create policy assignments_select_mya_admin
  on public.assignments
  for select
  to authenticated
  using (
    ((select auth.jwt()) ->> 'role') = 'platform_admin'
    or user_id = (select auth.uid())
    or exists (
      select 1
      from public.organization_memberships as m
      where m.user_id = (select auth.uid())
        and m.organization_id = assignments.organization_id
        and m.role = any (array['admin'::text, 'owner'::text])
        and m.status = 'active'
    )
  );

drop policy if exists assignments_update_mya_admin on public.assignments;
create policy assignments_update_mya_admin
  on public.assignments
  for update
  to authenticated
  using (
    ((select auth.jwt()) ->> 'role') = 'platform_admin'
    or user_id = (select auth.uid())
    or exists (
      select 1
      from public.organization_memberships as m
      where m.user_id = (select auth.uid())
        and m.organization_id = assignments.organization_id
        and m.role = any (array['admin'::text, 'owner'::text])
        and m.status = 'active'
    )
  )
  with check (
    ((select auth.jwt()) ->> 'email') = 'mya@the-huddle.co'
    or user_id = (select auth.uid())
    or exists (
      select 1
      from public.organization_memberships as m
      where m.user_id = (select auth.uid())
        and m.organization_id = assignments.organization_id
        and m.role = any (array['admin'::text, 'owner'::text])
        and m.status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- Duplicate index cleanup
-- Keep one index from each identical pair, preferring canonical names used by
-- schema verification or primary-key constraints where applicable.
-- ---------------------------------------------------------------------------
drop index if exists public.idx_certificates_organization_id;
drop index if exists public.idx_course_assignments_organization_id;
drop index if exists public.idx_course_engagement_organization_id;
drop index if exists public.idx_email_logs_organization_id;
drop index if exists public.idx_learner_journeys_organization_id;
drop index if exists public.idx_lessons_organization_id;
drop index if exists public.idx_message_logs_organization_id;
drop index if exists public.idx_modules_organization_id;
drop index if exists public.idx_notifications_organization_id;
drop index if exists public.idx_organization_courses_organization_id;
drop index if exists public.idx_org_memberships_organization_id;
drop index if exists public.organization_memberships_organization_id_user_id_idx;
drop index if exists public.idx_organization_profiles_organization_id;
drop index if exists public.idx_survey_responses_organization_id;
drop index if exists public.idx_team_huddle_comments_organization_id;
drop index if exists public.idx_team_huddle_post_reactions_organization_id;
drop index if exists public.idx_team_huddle_reactions_organization_id;
drop index if exists public.idx_user_lesson_progress_organization_id;
drop index if exists public.idx_user_profiles_organization_id;

-- Drop the redundant user_course_progress_unique only when it is identical to
-- the primary key. If it was accidentally created as a constraint, remove that
-- constraint instead of attempting to drop its backing index directly.
do $$
declare
  pkey_oid oid;
  dup_oid oid;
  is_duplicate boolean := false;
  dup_constraint_name text;
begin
  select c.oid
    into pkey_oid
  from pg_class as c
  where c.relkind = 'i'
    and c.relname = 'user_course_progress_pkey'
    and c.relnamespace = 'public'::regnamespace;

  select c.oid
    into dup_oid
  from pg_class as c
  where c.relkind = 'i'
    and c.relname = 'user_course_progress_unique'
    and c.relnamespace = 'public'::regnamespace;

  if pkey_oid is null or dup_oid is null then
    return;
  end if;

  select (pi.indrelid = di.indrelid)
     and (pi.indnkeyatts = di.indnkeyatts)
     and (pi.indnatts = di.indnatts)
     and (pi.indisunique = di.indisunique)
     and (pi.indkey = di.indkey)
     and (pi.indclass = di.indclass)
     and (pi.indcollation = di.indcollation)
     and (pi.indoption = di.indoption)
     and (pg_get_expr(pi.indpred, pi.indrelid) is not distinct from pg_get_expr(di.indpred, di.indrelid))
     and (pg_get_expr(pi.indexprs, pi.indrelid) is not distinct from pg_get_expr(di.indexprs, di.indrelid))
    into is_duplicate
  from pg_index as pi
  join pg_index as di on true
  where pi.indexrelid = pkey_oid
    and di.indexrelid = dup_oid;

  if not is_duplicate then
    return;
  end if;

  select con.conname
    into dup_constraint_name
  from pg_constraint as con
  where con.conindid = dup_oid
  limit 1;

  if dup_constraint_name is not null then
    execute format('alter table public.user_course_progress drop constraint if exists %I', dup_constraint_name);
  else
    execute 'drop index if exists public.user_course_progress_unique';
  end if;
end
$$;

commit;
