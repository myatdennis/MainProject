-- Phase 6 cleanup: enforce org_id presence across analytics artifacts
-- Date: 2026-01-13

begin;

-- Remove legacy rows that still lack org context so refreshed views stay org-scoped
delete from public.analytics_events where org_id is null;
delete from public.analytics_event_batches where org_id is null;
delete from public.user_course_progress where org_id is null;
delete from public.user_lesson_progress where org_id is null;

delete from public.org_enrollment_stats_mv where org_id is null;

-- Rebuild analytics views without org_id rollups/fallbacks
create or replace view public.view_course_completion_rate as
select
  org_id,
  course_id,
  count(*) as total_users,
  count(*) filter (where completed) as completed_count,
  case when count(*) = 0 then 0
       else round(100.0 * count(*) filter (where completed) / nullif(count(*), 0), 2)
  end as completion_percent,
  max(updated_at) as last_updated
from public.user_course_progress
where org_id is not null
group by org_id, course_id;

create or replace view public.view_course_avg_progress as
select
  org_id,
  course_id,
  round(avg(progress)::numeric, 2) as avg_progress,
  max(updated_at) as last_updated
from public.user_course_progress
where org_id is not null
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
where org_id is not null
group by org_id, course_id, lesson_id;

create or replace view public.view_admin_overview as
with scoped_progress as (
  select org_id, user_id, course_id, progress, completed, updated_at
  from public.user_course_progress
  where org_id is not null
),
org_counts as (
  select count(distinct org_id) as total_orgs from scoped_progress
),
org_progress as (
  select
    org_id,
    count(distinct user_id) as total_active_learners,
    count(distinct course_id) as total_courses,
    round(avg(progress)::numeric, 2) as platform_avg_progress,
    max(updated_at) as last_updated
  from scoped_progress
  group by org_id
),
org_completion as (
  select org_id, round(avg(completion_percent)::numeric, 2) as platform_avg_completion
  from public.view_course_completion_rate
  where org_id is not null
  group by org_id
)
select
  p.org_id,
  p.total_active_learners,
  (select total_orgs from org_counts) as total_orgs,
  p.total_courses,
  p.platform_avg_progress,
  coalesce(c.platform_avg_completion, 0) as platform_avg_completion,
  p.last_updated
from org_progress p
left join org_completion c on c.org_id = p.org_id;

refresh materialized view public.org_enrollment_stats_mv;

commit;

-- Retune the batched progress ingestion proc to require org_id
create or replace function public.upsert_progress_batch(events_json jsonb)
  returns table(accepted text[], duplicates text[])
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  accepted_ids text[];
  duplicate_ids text[];
  uuid_regex constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
begin
  with incoming as (
    select
      coalesce(event->>'client_event_id', event->>'clientEventId', event->>'id') as client_event_id,
      nullif(event->>'user_id', '') as user_id,
      nullif(event->>'course_id', '') as course_id,
      nullif(event->>'lesson_id', '') as lesson_id,
      case when (event->>'org_id') ~* uuid_regex then (event->>'org_id')::uuid else null end as org_id,
      greatest(0, least(100, coalesce((event->>'percent')::numeric, 0))) as progress,
      greatest(0, coalesce(
        (event->>'time_spent_seconds')::integer,
        (event->>'time_spent_s')::integer,
        (event->>'timeSpentSeconds')::integer,
        0
      )) as time_spent_seconds,
      greatest(0, coalesce(
        (event->>'resume_at_seconds')::integer,
        (event->>'resume_at_s')::integer,
        (event->>'position')::integer,
        (event->>'position_seconds')::integer,
        0
      )) as resume_at_seconds,
      coalesce(event->>'status', event->>'event_status') as status,
      coalesce(event->>'event_type', event->>'type') as event_type,
      coalesce(
        (event->>'occurred_at')::timestamptz,
        (event->>'occurredAt')::timestamptz,
        now()
      ) as occurred_at
    from jsonb_array_elements(events_json) as event
  ),
  filtered as (
    select *
    from incoming
    where client_event_id is not null
      and user_id is not null
      and org_id is not null
      and (course_id is not null or lesson_id is not null)
  ),
  deduped as (
    select f.*, (pe.id is not null) as is_duplicate
    from filtered f
    left join public.progress_events pe on pe.id = f.client_event_id
  ),
  inserted_events as (
    insert into public.progress_events (id, user_id, course_id, lesson_id, payload)
    select
      client_event_id,
      user_id,
      course_id,
      lesson_id,
      jsonb_build_object(
        'percent', progress,
        'time_spent_seconds', time_spent_seconds,
        'status', status,
        'event_type', event_type,
        'occurred_at', occurred_at,
        'org_id', org_id::text
      )
    from deduped
    where not is_duplicate
    on conflict (id) do nothing
    returning id
  )
  select coalesce(array_agg(id), array[]::text[])
  into accepted_ids
  from inserted_events;

  select coalesce(array_agg(client_event_id), array[]::text[])
  into duplicate_ids
  from deduped
  where is_duplicate;

  with upsert_lessons as (
    insert into public.user_lesson_progress (
      user_id,
      course_id,
      lesson_id,
      org_id,
      progress,
      time_spent_seconds,
      completed,
      updated_at
    )
    select
      d.user_id,
      d.course_id,
      d.lesson_id,
      d.org_id,
      d.progress,
      greatest(d.time_spent_seconds, d.resume_at_seconds),
      d.progress >= 100 or lower(coalesce(d.status, '')) = 'completed',
      d.occurred_at
    from deduped d
    where not d.is_duplicate and d.lesson_id is not null
    on conflict (user_id, lesson_id) do update set
      progress = greatest(excluded.progress, public.user_lesson_progress.progress),
      time_spent_seconds = greatest(
        coalesce(excluded.time_spent_seconds, 0),
        coalesce(public.user_lesson_progress.time_spent_seconds, 0)
      ),
      completed = public.user_lesson_progress.completed or excluded.completed,
      updated_at = greatest(excluded.updated_at, public.user_lesson_progress.updated_at)
  )
  select 1;

  with upsert_courses as (
    insert into public.user_course_progress (
      user_id,
      course_id,
      org_id,
      progress,
      completed,
      updated_at
    )
    select
      d.user_id,
      d.course_id,
      d.org_id,
      d.progress,
      d.progress >= 100 or lower(coalesce(d.status, '')) = 'completed',
      d.occurred_at
    from deduped d
    where not d.is_duplicate and d.course_id is not null
    on conflict (user_id, course_id) do update set
      progress = greatest(excluded.progress, public.user_course_progress.progress),
      completed = public.user_course_progress.completed or excluded.completed,
      updated_at = greatest(excluded.updated_at, public.user_course_progress.updated_at)
  )
  select 1;

  accepted := coalesce(accepted_ids, array[]::text[]);
  duplicates := coalesce(duplicate_ids, array[]::text[]);
  return next;
  return;
end;
$$;
