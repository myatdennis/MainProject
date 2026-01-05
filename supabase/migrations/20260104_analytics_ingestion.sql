-- Phase 7: Analytics ingestion pipeline + org aware views
-- Date: 2026-01-04

create table if not exists public.analytics_event_batches (
  id uuid primary key default gen_random_uuid(),
  client_event_id text not null,
  org_id uuid,
  course_id uuid,
  lesson_id uuid,
  user_id uuid,
  event_type text not null,
  status text not null default 'accepted',
  error text,
  received_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists analytics_event_batches_client_event_id_idx
  on public.analytics_event_batches(client_event_id);
create index if not exists analytics_event_batches_org_id_idx
  on public.analytics_event_batches(org_id);
create index if not exists analytics_event_batches_course_id_idx
  on public.analytics_event_batches(course_id);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.analytics_event_batches(id) on delete cascade,
  org_id uuid,
  course_id uuid,
  lesson_id uuid,
  user_id uuid,
  event_name text not null,
  event_version text,
  properties jsonb not null default '{}'::jsonb,
  context jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  received_at timestamptz not null default now()
);

create index if not exists analytics_events_batch_id_idx on public.analytics_events(batch_id);
create index if not exists analytics_events_org_course_idx on public.analytics_events(org_id, course_id);
create index if not exists analytics_events_occurred_at_idx on public.analytics_events(occurred_at);

create table if not exists public.analytics_dead_letters (
  id uuid primary key default gen_random_uuid(),
  client_event_id text,
  payload jsonb not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists analytics_dead_letters_client_event_id_idx
  on public.analytics_dead_letters(client_event_id);

create table if not exists public.analytics_insights (
  org_id uuid,
  metric text not null,
  value jsonb not null,
  refreshed_at timestamptz not null default now(),
  source text not null default 'batch',
  primary key (org_id, metric)
);

-- Org-aware analytic views
create or replace view public.view_course_completion_rate as
select
  org_id,
  course_id,
  count(*) filter (where true) as total_users,
  count(*) filter (where completed) as completed_count,
  case when count(*) = 0 then 0
       else round(100.0 * count(*) filter (where completed) / nullif(count(*), 0), 2)
  end as completion_percent,
  max(updated_at) as last_updated
from public.user_course_progress
group by org_id, course_id;

create or replace view public.view_course_avg_progress as
select
  org_id,
  course_id,
  round(avg(progress)::numeric, 2) as avg_progress,
  max(updated_at) as last_updated
from public.user_course_progress
group by org_id, course_id;

create or replace view public.view_lesson_dropoff as
select
  org_id,
  course_id,
  lesson_id,
  count(*) as started_count,
  count(*) filter (where completed) as completed_count,
  case when count(*) = 0 then 0
       else round(100.0 * (1 - (count(*) filter (where completed) / nullif(count(*), 0)))::numeric, 2)
  end as dropoff_percent
from public.user_lesson_progress
group by org_id, course_id, lesson_id;

create or replace view public.view_admin_overview as
with total_orgs as (
  select count(distinct org_id) as value
  from public.user_course_progress
  where org_id is not null
),
progress as (
  select
    org_id,
    count(distinct user_id) as total_active_learners,
    count(distinct course_id) as total_courses,
    round(avg(progress)::numeric, 2) as platform_avg_progress
  from public.user_course_progress
  group by rollup (org_id)
),
completion as (
  select org_id, round(avg(completion_percent)::numeric, 2) as platform_avg_completion
  from public.view_course_completion_rate
  group by rollup (org_id)
)
select
  progress.org_id,
  progress.total_active_learners,
  (select value from total_orgs) as total_orgs,
  progress.total_courses,
  coalesce(progress.platform_avg_progress, 0) as platform_avg_progress,
  coalesce(completion.platform_avg_completion, 0) as platform_avg_completion
from progress
left join completion on completion.org_id is not distinct from progress.org_id;
