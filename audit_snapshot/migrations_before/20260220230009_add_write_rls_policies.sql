begin;

-- USER PROFILE INSERT
create policy "users_insert_profile"
on public.user_profiles
for insert
to authenticated
with check (auth.uid() = id);

------------------------------------------------

-- MEMBERSHIP INSERT (backend or workflows)
create policy "membership_insert"
on public.organization_memberships
for insert
to authenticated
with check (true);

------------------------------------------------

-- ANALYTICS INSERT
create policy "analytics_insert"
on public.analytics_events
for insert
to authenticated
with check (true);

------------------------------------------------

-- COURSE ENGAGEMENT INSERT
create policy "course_engagement_insert"
on public.course_engagement
for insert
to authenticated
with check (true);

commit;