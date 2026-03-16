-- =============================================================================
-- Repair: create survey_responses table that was missing from prod.
-- The earlier preflight (20260313180000) was recorded as applied but the table
-- creation failed because public.assignments did not yet have assignment_id.
-- This migration creates it cleanly now that all dependencies exist.
-- =============================================================================

create table if not exists public.survey_responses (
  id            uuid        primary key default gen_random_uuid(),
  survey_id     text        references public.surveys(id) on delete cascade,
  assignment_id uuid        references public.assignments(id) on delete set null,
  user_id       uuid        references auth.users(id) on delete set null,
  response      jsonb       not null default '{}'::jsonb,
  status        text        not null default 'completed',
  metadata      jsonb       not null default '{}'::jsonb,
  completed_at  timestamptz,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now())
);

create index if not exists survey_responses_survey_idx     on public.survey_responses(survey_id);
create index if not exists survey_responses_assignment_idx on public.survey_responses(assignment_id) where assignment_id is not null;
create index if not exists survey_responses_user_idx       on public.survey_responses(user_id);

drop trigger if exists survey_responses_set_updated_at on public.survey_responses;
create trigger survey_responses_set_updated_at
  before update on public.survey_responses
  for each row execute function public.set_updated_at();

alter table public.survey_responses enable row level security;

drop policy if exists "survey_responses_service_full_access" on public.survey_responses;
create policy "survey_responses_service_full_access"
  on public.survey_responses for all to service_role
  using (true) with check (true);
