alter table if exists public.lesson_reflections enable row level security;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'lesson_reflections'
      and policyname = 'Users can manage own lesson reflections'
  ) then
    drop policy "Users can manage own lesson reflections" on public.lesson_reflections;
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'lesson_reflections'
      and policyname = 'Org admins can read lesson reflections'
  ) then
    drop policy "Org admins can read lesson reflections" on public.lesson_reflections;
  end if;
end $$;

-- Single SELECT policy for authenticated users, including own reflections and org admin membership.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'lesson_reflections'
      and policyname = 'Users can read own lesson reflections'
  ) then
    create policy "Users can read own lesson reflections"
      on public.lesson_reflections
      for select
      to authenticated
      using (
        (SELECT auth.uid()) = user_id
        or exists (
          select 1
          from public.organization_memberships membership
          where membership.organization_id = lesson_reflections.organization_id
            and membership.user_id = (SELECT auth.uid())
            and membership.status = 'active'
            and lower(coalesce(membership.role, 'member')) in ('owner', 'admin', 'manager')
        )
      );
  else
    alter policy "Users can read own lesson reflections"
      on public.lesson_reflections
      using (
        (SELECT auth.uid()) = user_id
        or exists (
          select 1
          from public.organization_memberships membership
          where membership.organization_id = lesson_reflections.organization_id
            and membership.user_id = (SELECT auth.uid())
            and membership.status = 'active'
            and lower(coalesce(membership.role, 'member')) in ('owner', 'admin', 'manager')
        )
      );
  end if;
end $$;

-- Create action-specific policies for authenticated users managing their own reflections.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'lesson_reflections'
      and policyname = 'Users can create own lesson reflections'
  ) then
    create policy "Users can create own lesson reflections"
      on public.lesson_reflections
      for insert
      to authenticated
      with check ((SELECT auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'lesson_reflections'
      and policyname = 'Users can update own lesson reflections'
  ) then
    create policy "Users can update own lesson reflections"
      on public.lesson_reflections
      for update
      to authenticated
      using ((SELECT auth.uid()) = user_id)
      with check ((SELECT auth.uid()) = user_id);
  else
    alter policy "Users can update own lesson reflections"
      on public.lesson_reflections
      using ((SELECT auth.uid()) = user_id)
      with check ((SELECT auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'lesson_reflections'
      and policyname = 'Users can delete own lesson reflections'
  ) then
    create policy "Users can delete own lesson reflections"
      on public.lesson_reflections
      for delete
      to authenticated
      using ((SELECT auth.uid()) = user_id);
  else
    alter policy "Users can delete own lesson reflections"
      on public.lesson_reflections
      using ((SELECT auth.uid()) = user_id);
  end if;
end $$;
