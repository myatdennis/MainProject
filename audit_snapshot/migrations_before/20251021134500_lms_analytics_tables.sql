create extension if not exists "uuid-ossp";

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  course_id text,
  lesson_id text,
  module_id text,
  event_type text not null,
  session_id text,
  user_agent text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_user_idx on public.analytics_events(user_id, created_at desc);
create index if not exists analytics_events_course_idx on public.analytics_events(course_id, created_at desc);

create table if not exists public.learner_journeys (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  course_id text not null,
  started_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  completed_at timestamptz,
  total_time_spent integer not null default 0,
  sessions_count integer not null default 0,
  progress_percentage numeric(5,2) not null default 0,
  engagement_score numeric(5,2) not null default 0,
  milestones jsonb not null default '[]'::jsonb,
  drop_off_points jsonb not null default '[]'::jsonb,
  path_taken jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create unique index if not exists learner_journeys_user_course_idx on public.learner_journeys(user_id, course_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'learner_journeys_set_updated_at') then
    create trigger learner_journeys_set_updated_at
    before update on public.learner_journeys
    for each row execute function public.set_updated_at();
  end if;
end$$;
