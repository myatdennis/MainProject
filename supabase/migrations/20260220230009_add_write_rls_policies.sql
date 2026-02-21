begin;

-- USER PROFILE INSERT
drop policy if exists "users_insert_profile" on public.user_profiles;
create policy "users_insert_profile"
on public.user_profiles
for insert
to authenticated
with check (auth.uid() = id);

------------------------------------------------

-- MEMBERSHIP INSERT (backend or workflows)
-- keep it broad if your app creates memberships as part of onboarding.
drop policy if exists "membership_insert" on public.organization_memberships;
create policy "membership_insert"
on public.organization_memberships
for insert
to authenticated
with check (true);

------------------------------------------------

-- ANALYTICS INSERT
drop policy if exists "analytics_insert" on public.analytics_events;
create policy "analytics_insert"
on public.analytics_events
for insert
to authenticated
with check (true);

------------------------------------------------

-- COURSE ENGAGEMENT INSERT
drop policy if exists "course_engagement_insert" on public.course_engagement;
create policy "course_engagement_insert"
on public.course_engagement
for insert
to authenticated
with check (true);

commit;