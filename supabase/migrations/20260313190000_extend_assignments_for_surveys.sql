-- Extend assignments table to support survey parity
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'assignments'
      and column_name = 'assignment_type'
  ) then
    alter table public.assignments
      add column assignment_type text not null default 'course',
      add column survey_id text references public.surveys(id) on delete cascade;
  else
    alter table public.assignments
      add column if not exists survey_id text references public.surveys(id) on delete cascade;
  end if;
end$$;

alter table public.assignments
  alter column assignment_type set not null,
  alter column assignment_type set default 'course';

alter table public.assignments
  alter column course_id drop not null;

update public.assignments
  set assignment_type = 'course'
  where assignment_type is null;

alter table public.assignments
  drop constraint if exists assignments_target_consistency;

alter table public.assignments
  add constraint assignments_target_consistency
  check (
    (assignment_type = 'course' and course_id is not null and survey_id is null)
    or (assignment_type = 'survey' and survey_id is not null and course_id is null)
  );

create index if not exists assignments_assignment_type_idx
  on public.assignments(assignment_type);

create index if not exists assignments_survey_id_idx
  on public.assignments(survey_id)
  where assignment_type = 'survey';

drop index if exists assignments_unique_user_per_course;
create unique index assignments_unique_user_per_course
  on public.assignments(course_id, user_id)
  where assignment_type = 'course'
    and user_id is not null;

drop index if exists assignments_unique_org_per_course;
create unique index assignments_unique_org_per_course
  on public.assignments(course_id, organization_id)
  where assignment_type = 'course'
    and user_id is null
    and organization_id is not null;

create unique index if not exists assignments_unique_user_per_survey
  on public.assignments(survey_id, user_id)
  where assignment_type = 'survey'
    and user_id is not null;

create unique index if not exists assignments_unique_org_per_survey
  on public.assignments(survey_id, organization_id)
  where assignment_type = 'survey'
    and user_id is null
    and organization_id is not null;
