-- Harden RLS for learning content and progress tables to align with Edge API contract

-- Modules table policies
alter table public.modules enable row level security;

drop policy if exists "Modules service role access" on public.modules;
drop policy if exists "Modules member read" on public.modules;
drop policy if exists "Modules admin manage" on public.modules;

create policy "Modules service role access"
  on public.modules
  for all
  to service_role
  using (true)
  with check (true);

create policy "Modules member read"
  on public.modules
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.courses c
      where c.id = public.modules.course_id
        and (
          c.organization_id is null
          or exists (
            select 1
            from public.organization_memberships m
            where m.org_id = c.organization_id
              and m.user_id = auth.uid()
          )
        )
    )
  );

create policy "Modules admin manage"
  on public.modules
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.courses c
      join public.organization_memberships m
        on m.org_id = c.organization_id
      where c.id = public.modules.course_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin', 'owner', 'manager', 'editor')
    )
    or exists (
      select 1
      from public.courses c
      where c.id = public.modules.course_id
        and c.organization_id is null
        and c.created_by::text = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1
      from public.courses c
      join public.organization_memberships m
        on m.org_id = c.organization_id
      where c.id = public.modules.course_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin', 'owner', 'manager', 'editor')
    )
    or exists (
      select 1
      from public.courses c
      where c.id = public.modules.course_id
        and c.organization_id is null
        and c.created_by::text = auth.uid()::text
    )
  );

-- Lessons table policies
alter table public.lessons enable row level security;

drop policy if exists "Lessons service role access" on public.lessons;
drop policy if exists "Lessons member read" on public.lessons;
drop policy if exists "Lessons admin manage" on public.lessons;

create policy "Lessons service role access"
  on public.lessons
  for all
  to service_role
  using (true)
  with check (true);

create policy "Lessons member read"
  on public.lessons
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.modules m
      join public.courses c on c.id = m.course_id
      where m.id = public.lessons.module_id
        and (
          c.organization_id is null
          or exists (
            select 1
            from public.organization_memberships om
            where om.org_id = c.organization_id
              and om.user_id = auth.uid()
          )
        )
    )
  );

create policy "Lessons admin manage"
  on public.lessons
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.modules m
      join public.courses c on c.id = m.course_id
      join public.organization_memberships om
        on om.org_id = c.organization_id
      where m.id = public.lessons.module_id
        and om.user_id = auth.uid()
        and lower(coalesce(om.role, 'member')) in ('admin', 'owner', 'manager', 'editor')
    )
    or exists (
      select 1
      from public.modules m
      join public.courses c on c.id = m.course_id
      where m.id = public.lessons.module_id
        and c.organization_id is null
        and c.created_by::text = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1
      from public.modules m
      join public.courses c on c.id = m.course_id
      join public.organization_memberships om
        on om.org_id = c.organization_id
      where m.id = public.lessons.module_id
        and om.user_id = auth.uid()
        and lower(coalesce(om.role, 'member')) in ('admin', 'owner', 'manager', 'editor')
    )
    or exists (
      select 1
      from public.modules m
      join public.courses c on c.id = m.course_id
      where m.id = public.lessons.module_id
        and c.organization_id is null
        and c.created_by::text = auth.uid()::text
    )
  );

-- Assignments table policies
alter table public.assignments enable row level security;

drop policy if exists "Assignments service role access" on public.assignments;
drop policy if exists "Assignments learner read" on public.assignments;
drop policy if exists "Assignments admin manage" on public.assignments;

create policy "Assignments service role access"
  on public.assignments
  for all
  to service_role
  using (true)
  with check (true);

create policy "Assignments learner read"
  on public.assignments
  for select
  to authenticated
  using (
    (public.assignments.user_id is not null and public.assignments.user_id = auth.uid()::text)
    or (
      public.assignments.organization_id is not null and exists (
        select 1
        from public.organization_memberships m
        where m.org_id = public.assignments.organization_id
          and m.user_id = auth.uid()
      )
    )
  );

create policy "Assignments admin manage"
  on public.assignments
  for all
  to authenticated
  using (
    public.assignments.organization_id is null
    or exists (
      select 1
      from public.organization_memberships m
      where m.org_id = public.assignments.organization_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin', 'owner', 'manager', 'editor')
    )
  )
  with check (
    public.assignments.organization_id is null
    or exists (
      select 1
      from public.organization_memberships m
      where m.org_id = public.assignments.organization_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin', 'owner', 'manager', 'editor')
    )
  );

-- User course progress policies
alter table public.user_course_enrollments enable row level security;

drop policy if exists "Course enrollments service role" on public.user_course_enrollments;
drop policy if exists "Course enrollments self manage" on public.user_course_enrollments;
drop policy if exists "Course enrollments admin read" on public.user_course_enrollments;

create policy "Course enrollments service role"
  on public.user_course_enrollments
  for all
  to service_role
  using (true)
  with check (true);

create policy "Course enrollments self manage"
  on public.user_course_enrollments
  for all
  to authenticated
  using (public.user_course_enrollments.user_id = auth.uid()::text)
  with check (public.user_course_enrollments.user_id = auth.uid()::text);

create policy "Course enrollments admin read"
  on public.user_course_enrollments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.courses c
      join public.organization_memberships m
        on m.org_id = c.organization_id
      where c.id = public.user_course_enrollments.course_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin', 'owner', 'manager', 'editor')
    )
    or exists (
      select 1
      from public.courses c
      where c.id = public.user_course_enrollments.course_id
        and c.organization_id is null
        and c.created_by::text = auth.uid()::text
    )
  );

-- User lesson progress policies
alter table public.user_lesson_progress enable row level security;

drop policy if exists "Lesson progress service role" on public.user_lesson_progress;
drop policy if exists "Lesson progress self manage" on public.user_lesson_progress;
drop policy if exists "Lesson progress admin read" on public.user_lesson_progress;

create policy "Lesson progress service role"
  on public.user_lesson_progress
  for all
  to service_role
  using (true)
  with check (true);

create policy "Lesson progress self manage"
  on public.user_lesson_progress
  for all
  to authenticated
  using (public.user_lesson_progress.user_id = auth.uid())
  with check (public.user_lesson_progress.user_id = auth.uid());

create policy "Lesson progress admin read"
  on public.user_lesson_progress
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.lessons l
      join public.modules m on m.id = l.module_id
      join public.courses c on c.id = m.course_id
      join public.organization_memberships om
        on om.org_id = c.organization_id
      where l.id = public.user_lesson_progress.lesson_id
        and om.user_id = auth.uid()
        and lower(coalesce(om.role, 'member')) in ('admin', 'owner', 'manager', 'editor')
    )
    or exists (
      select 1
      from public.lessons l
      join public.modules m on m.id = l.module_id
      join public.courses c on c.id = m.course_id
      where l.id = public.user_lesson_progress.lesson_id
        and c.organization_id is null
        and c.created_by::text = auth.uid()::text
    )
  );

-- Analytics tables should only be accessible via service role
alter table public.analytics_events enable row level security;
alter table public.learner_journeys enable row level security;

drop policy if exists "Analytics events service role" on public.analytics_events;
drop policy if exists "Learner journeys service role" on public.learner_journeys;

create policy "Analytics events service role"
  on public.analytics_events
  for all
  to service_role
  using (true)
  with check (true);

create policy "Learner journeys service role"
  on public.learner_journeys
  for all
  to service_role
  using (true)
  with check (true);
