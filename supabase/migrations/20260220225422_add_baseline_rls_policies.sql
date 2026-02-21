begin;

-- USERS CAN READ OWN PROFILE
drop policy if exists "users_read_own_profile" on public.user_profiles;
create policy "users_read_own_profile"
on public.user_profiles
for select
to authenticated
using (auth.uid() = id);

-- USERS UPDATE OWN PROFILE
drop policy if exists "users_update_own_profile" on public.user_profiles;
create policy "users_update_own_profile"
on public.user_profiles
for update
to authenticated
using (auth.uid() = id);

------------------------------------------------

-- ORG MEMBERSHIPS READ
drop policy if exists "memberships_read" on public.organization_memberships;
create policy "memberships_read"
on public.organization_memberships
for select
to authenticated
using (user_id = auth.uid());

------------------------------------------------

-- ORGANIZATIONS READ
drop policy if exists "organizations_read" on public.organizations;
create policy "organizations_read"
on public.organizations
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = organizations.id
      and m.user_id = auth.uid()
  )
);

------------------------------------------------

-- COURSES READ
drop policy if exists "courses_read" on public.courses;
create policy "courses_read"
on public.courses
for select
to authenticated
using (true);

------------------------------------------------

-- LESSONS READ
drop policy if exists "lessons_read" on public.lessons;
create policy "lessons_read"
on public.lessons
for select
to authenticated
using (true);

------------------------------------------------

-- MODULES READ
drop policy if exists "modules_read" on public.modules;
create policy "modules_read"
on public.modules
for select
to authenticated
using (true);

commit;