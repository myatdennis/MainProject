-- Persistent courses schema and policies for Edge API

-- Ensure base schema additions exist
alter table public.courses
  add column if not exists organization_id text;

alter table public.courses
  add column if not exists name text;

update public.courses
   set name = coalesce(name, title)
 where name is null;

alter table public.courses
  add column if not exists created_by uuid references auth.users(id);

update public.courses
   set slug = coalesce(nullif(slug, ''), gen_random_uuid()::text)
 where slug is null or slug = '';

alter table public.courses
  alter column name set not null;

alter table public.courses
  alter column slug set not null;

create index if not exists courses_slug_idx on public.courses(slug);

-- Guard the updated_at column via trigger (trigger body already normalized elsewhere)
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'courses_set_updated_at'
  ) then
    create trigger courses_set_updated_at
      before update on public.courses
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- Harden row level security
alter table public.courses enable row level security;

drop policy if exists "Courses service role full access" on public.courses;
drop policy if exists "Courses admin manage" on public.courses;
drop policy if exists "Courses member read" on public.courses;
drop policy if exists "Courses owner update" on public.courses;
drop policy if exists "Courses owner delete" on public.courses;

create policy "Courses service role full access"
  on public.courses
  for all
  to service_role
  using (true)
  with check (true);

create policy "Courses admin manage"
  on public.courses
  for all
  to authenticated
  using (
    public.courses.organization_id is null
    or exists (
      select 1
      from public.organization_memberships m
      where m.org_id = public.courses.organization_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin', 'owner')
    )
  )
  with check (
    public.courses.organization_id is null
    or exists (
      select 1
      from public.organization_memberships m
      where m.org_id = public.courses.organization_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin', 'owner')
    )
  );

create policy "Courses member read"
  on public.courses
  for select
  to authenticated
  using (
    public.courses.organization_id is null
    or exists (
      select 1
      from public.organization_memberships m
      where m.org_id = public.courses.organization_id
        and m.user_id = auth.uid()
    )
  );

create policy "Courses owner update"
  on public.courses
  for update
  to authenticated
  using ((public.courses.created_by)::text = auth.uid()::text)
  with check ((public.courses.created_by)::text = auth.uid()::text);

create policy "Courses owner delete"
  on public.courses
  for delete
  to authenticated
  using ((public.courses.created_by)::text = auth.uid()::text);

-- Remove legacy seed course that interferes with smoke tests
delete from public.courses
 where id = '00000000-0000-0000-0000-000000000001'
   and title = 'Sample Inclusive Leadership Course';

-- Ensure notifications can participate in updated_at triggers
alter table public.notifications
  add column if not exists updated_at timestamptz not null default now();
