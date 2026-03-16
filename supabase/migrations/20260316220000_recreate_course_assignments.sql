-- course_assignments table was recorded in schema_migrations but DDL never executed.
-- This migration creates the table with all required columns including updated_at.

create table if not exists public.course_assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  assigned_by uuid references auth.users(id),
  status text not null default 'assigned',
  metadata jsonb not null default '{}'::jsonb,
  assigned_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists course_assignments_course_id_idx on public.course_assignments(course_id);
create index if not exists course_assignments_user_id_idx on public.course_assignments(user_id);
create index if not exists course_assignments_organization_id_idx on public.course_assignments(organization_id);

alter table public.course_assignments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'course_assignments'
      and policyname = 'course_assignments_user_select'
  ) then
    create policy "course_assignments_user_select"
      on public.course_assignments
      for select
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'course_assignments'
      and policyname = 'course_assignments_service_all'
  ) then
    create policy "course_assignments_service_all"
      on public.course_assignments
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

-- Auto-update updated_at on row changes
create or replace function public.set_course_assignments_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists trg_course_assignments_updated_at on public.course_assignments;
create trigger trg_course_assignments_updated_at
  before update on public.course_assignments
  for each row execute function public.set_course_assignments_updated_at();
