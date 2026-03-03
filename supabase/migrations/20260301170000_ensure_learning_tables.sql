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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'course_assignments'
      AND policyname = 'course_assignments_user_select'
  ) THEN
    CREATE POLICY "course_assignments_user_select"
      ON public.course_assignments
      FOR SELECT
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'course_assignments'
      AND policyname = 'course_assignments_service_all'
  ) THEN
    CREATE POLICY "course_assignments_service_all"
      ON public.course_assignments
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_course_progress'
      AND policyname = 'user_course_progress_self'
  ) THEN
    CREATE POLICY "user_course_progress_self"
      ON public.user_course_progress
      FOR SELECT USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_course_progress'
      AND policyname = 'user_course_progress_service'
  ) THEN
    CREATE POLICY "user_course_progress_service"
      ON public.user_course_progress
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_lesson_progress'
      AND policyname = 'user_lesson_progress_self'
  ) THEN
    CREATE POLICY "user_lesson_progress_self"
      ON public.user_lesson_progress
      FOR SELECT USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_lesson_progress'
      AND policyname = 'user_lesson_progress_service'
  ) THEN
    CREATE POLICY "user_lesson_progress_service"
      ON public.user_lesson_progress
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quiz_attempts'
      AND policyname = 'quiz_attempts_self'
  ) THEN
    CREATE POLICY "quiz_attempts_self"
      ON public.quiz_attempts
      FOR SELECT USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quiz_attempts'
      AND policyname = 'quiz_attempts_service'
  ) THEN
    CREATE POLICY "quiz_attempts_service"
      ON public.quiz_attempts
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
