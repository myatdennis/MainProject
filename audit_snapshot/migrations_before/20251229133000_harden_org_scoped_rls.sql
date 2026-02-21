-- 2025-12-29 Harden RLS policies to enforce real org scoping
-- This migration normalizes all critical LMS tables so that RLS checks
-- reference the actual organization_id / membership relationships that
-- exist in the schema.

-- Convenience helper to avoid repeating the admin role check inline
create or replace function public._is_org_admin(org_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.org_id = org_id
      and m.user_id = auth.uid()
      and lower(coalesce(m.role, 'member')) in ('admin','owner','manager','editor')
  );
$$;

drop function if exists public._is_org_member;
create or replace function public._is_org_member(org_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.org_id = org_id
      and m.user_id = auth.uid()
  );
$$;

------------------------------------------------------------------------------
-- Courses
------------------------------------------------------------------------------
alter table public.courses enable row level security;

drop policy if exists "Courses service role full access" on public.courses;
drop policy if exists "Courses admin manage" on public.courses;
drop policy if exists "Courses member read" on public.courses;
drop policy if exists "Courses owner update" on public.courses;
drop policy if exists "Courses owner delete" on public.courses;
drop policy if exists "allow_select_courses_for_org" on public.courses;
drop policy if exists "allow_manage_courses_for_org_admins" on public.courses;

create policy "courses_service_full_access"
  on public.courses
  for all
  to service_role
  using (true)
  with check (true);

create policy "courses_member_read"
  on public.courses
  for select
  to authenticated
  using (
    public.courses.organization_id is null
    or public._is_org_member(public.courses.organization_id)
    or (public.courses.created_by is not null and public.courses.created_by::text = auth.uid()::text)
  );

create policy "courses_admin_manage"
  on public.courses
  for all
  to authenticated
  using (
    public.courses.organization_id is null
    or public._is_org_admin(public.courses.organization_id)
    or (public.courses.created_by is not null and public.courses.created_by::text = auth.uid()::text)
  )
  with check (
    public.courses.organization_id is null
    or public._is_org_admin(public.courses.organization_id)
    or (public.courses.created_by is not null and public.courses.created_by::text = auth.uid()::text)
  );

------------------------------------------------------------------------------
-- Assignments
------------------------------------------------------------------------------
alter table public.assignments enable row level security;

drop policy if exists "allow_user_view_assignments" on public.assignments;
drop policy if exists "allow_manage_assignments_by_admin" on public.assignments;

drop policy if exists "assignments_service_full_access" on public.assignments;
drop policy if exists "assignments_member_read" on public.assignments;
drop policy if exists "assignments_admin_manage" on public.assignments;

create policy "assignments_service_full_access"
  on public.assignments
  for all
  to service_role
  using (true)
  with check (true);

create policy "assignments_self_access"
  on public.assignments
  for all
  to authenticated
  using (public.assignments.user_id is not null and public.assignments.user_id::text = auth.uid()::text)
  with check (public.assignments.user_id is not null and public.assignments.user_id::text = auth.uid()::text);

create policy "assignments_member_read"
  on public.assignments
  for select
  to authenticated
  using (
    public.assignments.organization_id is not null
    and public._is_org_member(public.assignments.organization_id)
  );

create policy "assignments_admin_manage"
  on public.assignments
  for all
  to authenticated
  using (
    public.assignments.organization_id is not null
    and public._is_org_admin(public.assignments.organization_id)
  )
  with check (
    public.assignments.organization_id is not null
    and public._is_org_admin(public.assignments.organization_id)
  );

------------------------------------------------------------------------------
-- User course progress
------------------------------------------------------------------------------
alter table public.user_course_progress enable row level security;

drop policy if exists "user_course_progress_service" on public.user_course_progress;
drop policy if exists "user_course_progress_self" on public.user_course_progress;
drop policy if exists "user_course_progress_admin" on public.user_course_progress;

create policy "user_course_progress_service"
  on public.user_course_progress
  for all
  to service_role
  using (true)
  with check (true);

create policy "user_course_progress_self"
  on public.user_course_progress
  for all
  to authenticated
  using (public.user_course_progress.user_id::text = auth.uid()::text)
  with check (public.user_course_progress.user_id::text = auth.uid()::text);

create policy "user_course_progress_admin"
  on public.user_course_progress
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.courses c
      where c.id = public.user_course_progress.course_id
        and (
          c.organization_id is null
          or public._is_org_admin(c.organization_id)
        )
    )
  );

------------------------------------------------------------------------------
-- User lesson progress
------------------------------------------------------------------------------
alter table public.user_lesson_progress enable row level security;

drop policy if exists "allow_user_manage_own_progress" on public.user_lesson_progress;

drop policy if exists "user_lesson_progress_service" on public.user_lesson_progress;
drop policy if exists "user_lesson_progress_self" on public.user_lesson_progress;
drop policy if exists "user_lesson_progress_admin" on public.user_lesson_progress;

create policy "user_lesson_progress_service"
  on public.user_lesson_progress
  for all
  to service_role
  using (true)
  with check (true);

create policy "user_lesson_progress_self"
  on public.user_lesson_progress
  for all
  to authenticated
  using (public.user_lesson_progress.user_id::text = auth.uid()::text)
  with check (public.user_lesson_progress.user_id::text = auth.uid()::text);

create policy "user_lesson_progress_admin"
  on public.user_lesson_progress
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.lessons l
      join public.modules mo on mo.id = l.module_id
      join public.courses c on c.id = mo.course_id
      where l.id = public.user_lesson_progress.lesson_id
        and (
          c.organization_id is null
          or public._is_org_admin(c.organization_id)
        )
    )
  );

------------------------------------------------------------------------------
-- Surveys
------------------------------------------------------------------------------
alter table public.surveys enable row level security;

drop policy if exists "Surveys service" on public.surveys;
drop policy if exists "Surveys member" on public.surveys;
drop policy if exists "Surveys admin" on public.surveys;
drop policy if exists "Surveys service role" on public.surveys;
drop policy if exists "Surveys member read" on public.surveys;
drop policy if exists "Surveys admin manage" on public.surveys;

create policy "surveys_service_full_access"
  on public.surveys
  for all
  to service_role
  using (true)
  with check (true);

create policy "surveys_member_read"
  on public.surveys
  for select
  to authenticated
  using (
    public.surveys.organization_id is null
    or public._is_org_member(public.surveys.organization_id)
  );

create policy "surveys_admin_manage"
  on public.surveys
  for all
  to authenticated
  using (
    public.surveys.organization_id is null
    or public._is_org_admin(public.surveys.organization_id)
  )
  with check (
    public.surveys.organization_id is null
    or public._is_org_admin(public.surveys.organization_id)
  );

------------------------------------------------------------------------------
-- Survey assignments
------------------------------------------------------------------------------
alter table public.survey_assignments enable row level security;

drop policy if exists "Survey assignments service role" on public.survey_assignments;
drop policy if exists "Survey assignments member read" on public.survey_assignments;
drop policy if exists "Survey assignments admin manage" on public.survey_assignments;

create policy "survey_assignments_service"
  on public.survey_assignments
  for all
  to service_role
  using (true)
  with check (true);

create policy "survey_assignments_member_read"
  on public.survey_assignments
  for select
  to authenticated
  using (
    exists (
      select 1
      from unnest(coalesce(public.survey_assignments.organization_ids, '{}')) as org_id
      where public._is_org_member(org_id)
    )
  );

create policy "survey_assignments_admin_manage"
  on public.survey_assignments
  for all
  to authenticated
  using (
    exists (
      select 1
      from unnest(coalesce(public.survey_assignments.organization_ids, '{}')) as org_id
      where public._is_org_admin(org_id)
    )
  )
  with check (
    exists (
      select 1
      from unnest(coalesce(public.survey_assignments.organization_ids, '{}')) as org_id
      where public._is_org_admin(org_id)
    )
  );

------------------------------------------------------------------------------
-- Survey responses
------------------------------------------------------------------------------
alter table public.survey_responses enable row level security;

drop policy if exists "Survey responses service" on public.survey_responses;
drop policy if exists "Survey responses member" on public.survey_responses;
drop policy if exists "Survey responses admin" on public.survey_responses;
drop policy if exists "Survey responses service role" on public.survey_responses;
drop policy if exists "Survey responses own" on public.survey_responses;
drop policy if exists "Survey responses submit" on public.survey_responses;
drop policy if exists "Survey responses admin manage" on public.survey_responses;

create policy "survey_responses_service"
  on public.survey_responses
  for all
  to service_role
  using (true)
  with check (true);

create policy "survey_responses_self"
  on public.survey_responses
  for all
  to authenticated
  using (public.survey_responses.user_id::text = auth.uid()::text)
  with check (public.survey_responses.user_id::text = auth.uid()::text);

create policy "survey_responses_member_read"
  on public.survey_responses
  for select
  to authenticated
  using (
    public.survey_responses.organization_id is not null
    and public._is_org_member(public.survey_responses.organization_id)
  );

create policy "survey_responses_admin_manage"
  on public.survey_responses
  for all
  to authenticated
  using (
    public.survey_responses.organization_id is not null
    and public._is_org_admin(public.survey_responses.organization_id)
  )
  with check (
    public.survey_responses.organization_id is not null
    and public._is_org_admin(public.survey_responses.organization_id)
  );
