-- 2026-01-04 Leadership AI recommendations schema
-- Adds storage + helper view for organization-level leadership insights

create table if not exists public.organization_leadership_recommendations (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.organizations(id) on delete cascade,
  title text not null,
  summary text not null,
  category text not null default 'engagement',
  priority text not null default 'medium',
  impact text,
  status text not null default 'open',
  confidence numeric(5,2),
  tags jsonb not null default '[]'::jsonb,
  data_points jsonb not null default '{}'::jsonb,
  generated_by text not null default 'heuristic',
  ai_model text,
  ai_version text,
  generated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists org_leadership_recommendations_org_idx on public.organization_leadership_recommendations(org_id);
create index if not exists org_leadership_recommendations_status_idx on public.organization_leadership_recommendations(status);

-- keep updated_at accurate
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'organization_leadership_recommendations_set_updated_at') then
    create trigger organization_leadership_recommendations_set_updated_at
      before update on public.organization_leadership_recommendations
      for each row execute function public.set_updated_at();
  end if;
end$$;

alter table public.organization_leadership_recommendations enable row level security;

drop policy if exists "leadership_recs_service" on public.organization_leadership_recommendations;
drop policy if exists "leadership_recs_member_read" on public.organization_leadership_recommendations;
drop policy if exists "leadership_recs_admin_manage" on public.organization_leadership_recommendations;

create policy "leadership_recs_service"
  on public.organization_leadership_recommendations
  for all
  to service_role
  using (true)
  with check (true);

create policy "leadership_recs_member_read"
  on public.organization_leadership_recommendations
  for select
  to authenticated
  using (public._is_org_member(organization_leadership_recommendations.org_id));

create policy "leadership_recs_admin_manage"
  on public.organization_leadership_recommendations
  for all
  to authenticated
  using (public._is_org_admin(organization_leadership_recommendations.org_id))
  with check (public._is_org_admin(organization_leadership_recommendations.org_id));

-- Aggregate helper view for quick org health lookups
create or replace view public.view_org_leadership_health as
with progress as (
  select
    org_id::text as org_id,
    count(distinct user_id) as active_learners,
    count(*) filter (where completed) as completed_records,
    count(*) as total_records,
    round(avg(progress)::numeric, 2) as avg_progress,
    round(
      case when count(*) = 0 then 0
           else 100.0 * count(*) filter (where completed) / nullif(count(*), 0)
      end,
      2
    ) as completion_rate
  from public.user_course_progress
  group by org_id
),
surveys as (
  select
    org_id::text as org_id,
    round(avg(coalesce(rating, 0))::numeric, 2) as avg_rating,
    count(*) as responses
  from public.survey_responses
  group by org_id
),
dropoffs as (
  select
    c.organization_id::text as org_id,
    max(v.dropoff_percent) as worst_dropoff
  from public.view_lesson_dropoff v
  join public.courses c on c.id = v.course_id
  group by c.organization_id
),
assignments as (
  select
    organization_id::text as org_id,
    count(*) filter (
      where status in ('pending', 'assigned') and due_at is not null and due_at < now()
    ) as overdue_assignments
  from public.assignments
  group by organization_id
)
select
  o.id as org_id,
  o.name,
  coalesce(progress.active_learners, 0) as active_learners,
  coalesce(progress.completion_rate, 0) as completion_rate,
  coalesce(progress.avg_progress, 0) as avg_progress,
  coalesce(surveys.avg_rating, 0) as avg_survey_rating,
  coalesce(surveys.responses, 0) as survey_responses,
  coalesce(assignments.overdue_assignments, 0) as overdue_assignments,
  coalesce(dropoffs.worst_dropoff, 0) as worst_dropoff
from public.organizations o
left join progress on progress.org_id = o.id
left join surveys on surveys.org_id = o.id
left join assignments on assignments.org_id = o.id
left join dropoffs on dropoffs.org_id = o.id;
