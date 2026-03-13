-- Survey assignment parity migration
-- 1) Ensure survey responses can link to individual assignment rows
alter table if exists public.survey_responses
  add column if not exists survey_id text references public.surveys(id) on delete cascade,
  add column if not exists assignment_id uuid references public.assignments(id) on delete set null,
  add column if not exists response jsonb default '{}'::jsonb,
  add column if not exists status text not null default 'completed',
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists completed_at timestamptz;

create index if not exists survey_responses_assignment_idx
  on public.survey_responses(assignment_id)
  where assignment_id is not null;

create index if not exists survey_responses_survey_idx
  on public.survey_responses(survey_id);

-- 2) Tighten indexes for survey assignments stored inside the unified assignments table
create index if not exists assignments_survey_user_active_idx
  on public.assignments(survey_id, lower(user_id))
  where assignment_type = 'survey'
    and user_id is not null
    and coalesce(active, true);

create index if not exists assignments_survey_org_active_idx
  on public.assignments(survey_id, organization_id)
  where assignment_type = 'survey'
    and organization_id is not null
    and coalesce(active, true)
    and user_id is null;

-- 3) Provide a helper to keep legacy survey_assignments aggregates in sync with canonical rows
create or replace function public.refresh_survey_assignment_aggregates(target_survey_id text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_survey_id is not null then
    delete from public.survey_assignments where survey_id = target_survey_id;

    insert into public.survey_assignments (survey_id, organization_ids, user_ids, cohort_ids, department_ids, updated_at)
    select
      a.survey_id,
      coalesce(array_agg(distinct a.organization_id::text) filter (where a.organization_id is not null), '{}'),
      coalesce(array_agg(distinct a.user_id) filter (where a.user_id is not null), '{}'),
      '{}'::text[],
      '{}'::text[],
      coalesce(max(a.updated_at), max(a.created_at), now())
    from public.assignments a
    where a.assignment_type = 'survey'
      and coalesce(a.active, true)
      and a.survey_id = target_survey_id
    group by a.survey_id;
    return;
  end if;

  delete from public.survey_assignments;

  insert into public.survey_assignments (survey_id, organization_ids, user_ids, cohort_ids, department_ids, updated_at)
  select
    a.survey_id,
    coalesce(array_agg(distinct a.organization_id::text) filter (where a.organization_id is not null), '{}'),
    coalesce(array_agg(distinct a.user_id) filter (where a.user_id is not null), '{}'),
    '{}'::text[],
    '{}'::text[],
    coalesce(max(a.updated_at), max(a.created_at), now())
  from public.assignments a
  where a.assignment_type = 'survey'
    and coalesce(a.active, true)
  group by a.survey_id;
end;
$$;

grant execute on function public.refresh_survey_assignment_aggregates(text) to anon, authenticated, service_role;
