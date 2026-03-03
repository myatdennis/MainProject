create extension if not exists "pgcrypto";

-- Core course assignment + progress tables (idempotent guards for existing installs).
create table if not exists public.course_assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  assigned_by uuid references auth.users(id),
  status text not null default 'assigned',
  metadata jsonb not null default '{}'::jsonb,
  assigned_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists course_assignments_course_id_idx on public.course_assignments(course_id);
create index if not exists course_assignments_user_id_idx on public.course_assignments(user_id);
alter table public.course_assignments enable row level security;

create policy if not exists "course_assignments_user_select"
  on public.course_assignments
  for select
  using (user_id = auth.uid());

create policy if not exists "course_assignments_service_all"
  on public.course_assignments
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists public.user_course_progress (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  status text not null default 'not_started',
  progress numeric not null default 0,
  time_spent_s integer not null default 0,
  completed boolean not null default false,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists user_course_progress_unique on public.user_course_progress(user_id, course_id);
create index if not exists user_course_progress_course_idx on public.user_course_progress(course_id);
alter table public.user_course_progress enable row level security;

create policy if not exists "user_course_progress_self"
  on public.user_course_progress
  for select using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy if not exists "user_course_progress_service"
  on public.user_course_progress
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists public.user_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  module_id uuid references public.modules(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  status text not null default 'not_started',
  progress numeric not null default 0,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists user_lesson_progress_unique on public.user_lesson_progress(user_id, lesson_id);
alter table public.user_lesson_progress enable row level security;

create policy if not exists "user_lesson_progress_self"
  on public.user_lesson_progress
  for select using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy if not exists "user_lesson_progress_service"
  on public.user_lesson_progress
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  score numeric not null default 0,
  passed boolean not null default false,
  responses jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists quiz_attempts_lesson_idx on public.quiz_attempts(lesson_id);
create index if not exists quiz_attempts_user_idx on public.quiz_attempts(user_id);
alter table public.quiz_attempts enable row level security;

create policy if not exists "quiz_attempts_self"
  on public.quiz_attempts
  for select using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy if not exists "quiz_attempts_service"
  on public.quiz_attempts
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
