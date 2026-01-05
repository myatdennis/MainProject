-- Phase 8: Batched progress ingestion stored procedure
-- Creates/updates helper used by /api/client/progress/batch to fan events into
-- user_lesson_progress, user_course_progress, and progress_events with a single call.

create or replace function public.upsert_progress_batch(events_json jsonb)
  returns table(accepted text[], duplicates text[])
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  accepted_ids text[];
  duplicate_ids text[];
begin
  with incoming as (
    select
      coalesce(event->>'client_event_id', event->>'clientEventId', event->>'id') as client_event_id,
      nullif(event->>'user_id', '') as user_id,
      nullif(event->>'course_id', '') as course_id,
      nullif(event->>'lesson_id', '') as lesson_id,
      nullif(event->>'org_id', '') as org_id,
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
        'occurred_at', occurred_at
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

  -- Fan out lesson-level updates
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
      nullif(d.org_id, ''),
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

  -- Course-level rollups
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
      nullif(d.org_id, ''),
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
