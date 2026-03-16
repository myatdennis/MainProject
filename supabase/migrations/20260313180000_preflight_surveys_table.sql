-- =============================================================================
-- Preflight: ensure public.surveys table exists.
-- Migration 20251021150000 was already recorded as applied in supabase_migrations
-- but the actual table is missing from prod (likely a partial failure).
-- This repair migration re-creates it safely.
-- =============================================================================

create extension if not exists "uuid-ossp";

create table if not exists public.surveys (
  id          text primary key default gen_random_uuid()::text,
  title       text not null,
  description text,
  type        text,
  status      text not null default 'draft',
  sections    jsonb not null default '[]'::jsonb,
  branding    jsonb not null default '{}'::jsonb,
  settings    jsonb not null default '{}'::jsonb,
  assigned_to jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists surveys_status_idx on public.surveys(status);
create index if not exists surveys_type_idx   on public.surveys(type);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'surveys_set_updated_at'
      and tgrelid = 'public.surveys'::regclass
  ) then
    create trigger surveys_set_updated_at
      before update on public.surveys
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.surveys enable row level security;

drop policy if exists "surveys_service_full_access" on public.surveys;
create policy "surveys_service_full_access"
  on public.surveys for all to service_role
  using (true) with check (true);

-- Also ensure survey_assignments table exists (depended on by the parity migration)
create table if not exists public.survey_assignments (
  id               uuid primary key default gen_random_uuid(),
  survey_id        text not null references public.surveys(id) on delete cascade,
  organization_ids text[]   not null default '{}',
  user_ids         text[]   not null default '{}',
  cohort_ids       text[]   not null default '{}',
  department_ids   text[]   not null default '{}',
  updated_at       timestamptz not null default timezone('utc', now()),
  unique (survey_id)
);

create index if not exists survey_assignments_survey_idx on public.survey_assignments(survey_id);

alter table public.survey_assignments enable row level security;

drop policy if exists "survey_assignments_service_full_access" on public.survey_assignments;
create policy "survey_assignments_service_full_access"
  on public.survey_assignments for all to service_role
  using (true) with check (true);

-- Also ensure survey_responses table exists (depended on by parity migration indexes)
create table if not exists public.survey_responses (
  id            uuid primary key default gen_random_uuid(),
  survey_id     text references public.surveys(id) on delete cascade,
  assignment_id uuid references public.assignments(id) on delete set null,
  user_id       uuid references auth.users(id) on delete set null,
  response      jsonb not null default '{}'::jsonb,
  status        text not null default 'completed',
  metadata      jsonb not null default '{}'::jsonb,
  completed_at  timestamptz,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now())
);

create index if not exists survey_responses_survey_idx      on public.survey_responses(survey_id);
create index if not exists survey_responses_assignment_idx  on public.survey_responses(assignment_id) where assignment_id is not null;
create index if not exists survey_responses_user_idx        on public.survey_responses(user_id);

alter table public.survey_responses enable row level security;

drop policy if exists "survey_responses_service_full_access" on public.survey_responses;
create policy "survey_responses_service_full_access"
  on public.survey_responses for all to service_role
  using (true) with check (true);
