alter table if exists public.lesson_reflections
  add column if not exists module_id uuid references public.modules(id) on delete set null,
  add column if not exists status text not null default 'draft';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lesson_reflections_status_check'
  ) then
    alter table public.lesson_reflections
      add constraint lesson_reflections_status_check
      check (status in ('draft', 'submitted'));
  end if;
end $$;

create index if not exists lesson_reflections_org_course_lesson_user_idx
  on public.lesson_reflections (organization_id, course_id, lesson_id, user_id);

create index if not exists lesson_reflections_org_course_module_idx
  on public.lesson_reflections (organization_id, course_id, module_id, lesson_id);

alter table if exists public.lesson_reflections enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lesson_reflections'
      and policyname = 'Users can read own lesson reflections'
  ) then
    create policy "Users can read own lesson reflections"
      on public.lesson_reflections
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lesson_reflections'
      and policyname = 'Users can manage own lesson reflections'
  ) then
    create policy "Users can manage own lesson reflections"
      on public.lesson_reflections
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lesson_reflections'
      and policyname = 'Org admins can read lesson reflections'
  ) then
    create policy "Org admins can read lesson reflections"
      on public.lesson_reflections
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.organization_memberships membership
          where membership.organization_id = lesson_reflections.organization_id
            and membership.user_id = auth.uid()
            and membership.status = 'active'
            and lower(coalesce(membership.role, 'member')) in ('owner', 'admin', 'manager')
        )
      );
  end if;
end $$;
