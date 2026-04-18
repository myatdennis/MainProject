-- Ensure survey_responses carries organization_id even if the table was
-- recreated by the later repair migration without the org-scoping column.

alter table if exists public.survey_responses
  add column if not exists organization_id uuid;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'survey_responses'
      and column_name = 'org_id'
  ) then
    update public.survey_responses
      set organization_id = coalesce(organization_id, nullif(org_id::text, '')::uuid)
      where organization_id is null
        and org_id is not null;
  end if;
end $$;

update public.survey_responses sr
set organization_id = a.organization_id
from public.assignments a
where sr.organization_id is null
  and sr.assignment_id is not null
  and a.id = sr.assignment_id
  and a.organization_id is not null;

update public.survey_responses sr
set organization_id = s.organization_id
from public.surveys s
where sr.organization_id is null
  and s.id = sr.survey_id
  and s.organization_id is not null;

alter table if exists public.survey_responses
  alter column organization_id type uuid using (organization_id::uuid);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'survey_responses_organization_fk'
      and conrelid = 'public.survey_responses'::regclass
  ) then
    alter table public.survey_responses
      add constraint survey_responses_organization_fk
      foreign key (organization_id) references public.organizations(id)
      on delete set null;
  end if;
end $$;

create index if not exists survey_responses_org_idx
  on public.survey_responses(organization_id);

do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception
  when undefined_function then
    null;
end $$;
