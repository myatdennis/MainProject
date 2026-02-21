-- Ensure required extensions are available
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- Core course catalog tables
create table if not exists public.courses (
  id text primary key default gen_random_uuid()::text,
  organization_id text,
  slug text unique,
  title text not null,
  description text,
  status text not null default 'draft',
  version integer not null default 1,
  meta_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'courses' and column_name = 'published_at'
  ) then
    alter table public.courses add column published_at timestamptz;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'courses' and column_name = 'due_date'
  ) then
    alter table public.courses add column due_date timestamptz;
  end if;
end$$;

create table if not exists public.modules (
  id text primary key default gen_random_uuid()::text,
  course_id text not null references public.courses(id) on delete cascade,
  order_index integer not null default 0,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists modules_course_idx on public.modules(course_id, order_index);

create table if not exists public.lessons (
  id text primary key default gen_random_uuid()::text,
  module_id text not null references public.modules(id) on delete cascade,
  order_index integer not null default 0,
  type text not null,
  title text not null,
  description text,
  duration_s integer,
  content_json jsonb not null default '{}'::jsonb,
  completion_rule_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lessons_module_idx on public.lessons(module_id, order_index);

-- Assignment + enrolment bridge
create table if not exists public.assignments (
  id text primary key default gen_random_uuid()::text,
  organization_id text,
  course_id text not null references public.courses(id) on delete cascade,
  user_id text,
  due_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assignments_org_course_idx on public.assignments(organization_id, course_id);
create index if not exists assignments_user_idx on public.assignments(user_id);

-- Progress tracking
create table if not exists public.user_course_progress (
  id text primary key default gen_random_uuid()::text,
  user_id text not null,
  course_id text not null references public.courses(id) on delete cascade,
  percent numeric(5,2) not null default 0,
  status text not null default 'not_started',
  time_spent_s integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists user_course_progress_unique on public.user_course_progress(user_id, course_id);

create table if not exists public.user_lesson_progress (
  id text primary key default gen_random_uuid()::text,
  user_id text not null,
  lesson_id text not null references public.lessons(id) on delete cascade,
  percent numeric(5,2) not null default 0,
  status text not null default 'not_started',
  time_spent_s integer not null default 0,
  resume_at_s integer,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists user_lesson_progress_unique on public.user_lesson_progress(user_id, lesson_id);

-- Certificates
create table if not exists public.certificates (
  id text primary key default gen_random_uuid()::text,
  user_id text not null,
  course_id text not null references public.courses(id) on delete cascade,
  issued_at timestamptz not null default now(),
  pdf_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists certificates_user_course_idx on public.certificates(user_id, course_id);

-- Trigger helpers to keep updated_at current
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'courses_set_updated_at') then
    create trigger courses_set_updated_at
    before update on public.courses
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'modules_set_updated_at') then
    create trigger modules_set_updated_at
    before update on public.modules
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'lessons_set_updated_at') then
    create trigger lessons_set_updated_at
    before update on public.lessons
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'assignments_set_updated_at') then
    create trigger assignments_set_updated_at
    before update on public.assignments
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'user_course_progress_set_updated_at') then
    create trigger user_course_progress_set_updated_at
    before update on public.user_course_progress
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'user_lesson_progress_set_updated_at') then
    create trigger user_lesson_progress_set_updated_at
    before update on public.user_lesson_progress
    for each row execute function public.set_updated_at();
  end if;
end$$;

-- Development seed (idempotent)
insert into public.courses (id, title, status)
select '00000000-0000-0000-0000-000000000001', 'Sample Inclusive Leadership Course', 'published'
where not exists (select 1 from public.courses where id = '00000000-0000-0000-0000-000000000001');
