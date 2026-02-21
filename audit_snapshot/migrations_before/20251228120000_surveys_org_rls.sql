-- Add organization scoping and RLS to surveys-related tables
-- Date: 2025-12-28

-- 1) Ensure surveys have an organization_id column
alter table public.surveys
  add column if not exists organization_id text references public.organizations(id);

create index if not exists surveys_organization_idx
  on public.surveys(organization_id);

-- 2) Align survey_responses to use organization_id text column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'survey_responses'
      AND column_name = 'org_id'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'survey_responses'
      AND column_name = 'organization_id'
  ) THEN
    EXECUTE 'alter table public.survey_responses rename column org_id to organization_id';
  END IF;
END $$;

alter table public.survey_responses
  add column if not exists organization_id text;

alter table public.survey_responses
  alter column organization_id type text using (organization_id::text);

alter table public.survey_responses
  drop constraint if exists survey_responses_organization_fk;

alter table public.survey_responses
  add constraint survey_responses_organization_fk
  foreign key (organization_id) references public.organizations(id)
  on delete set null;

create index if not exists survey_responses_org_idx
  on public.survey_responses(organization_id);

-- 3) Harden RLS for surveys table
alter table public.surveys enable row level security;

drop policy if exists "Surveys service" on public.surveys;
drop policy if exists "Surveys member" on public.surveys;
drop policy if exists "Surveys admin" on public.surveys;

drop policy if exists "Surveys service role" on public.surveys;
drop policy if exists "Surveys member read" on public.surveys;
drop policy if exists "Surveys admin manage" on public.surveys;

create policy "Surveys service role"
  on public.surveys
  for all
  to service_role
  using (true)
  with check (true);

create policy "Surveys member read"
  on public.surveys
  for select
  to authenticated
  using (
    public.surveys.organization_id is not null
    and exists (
      select 1
      from public.organization_memberships m
      where m.org_id = public.surveys.organization_id
        and m.user_id = auth.uid()
    )
  );

create policy "Surveys admin manage"
  on public.surveys
  for all
  to authenticated
  using (
    public.surveys.organization_id is not null
    and exists (
      select 1
      from public.organization_memberships m
      where m.org_id = public.surveys.organization_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin','owner','manager','editor')
    )
  )
  with check (
    public.surveys.organization_id is not null
    and exists (
      select 1
      from public.organization_memberships m
      where m.org_id = public.surveys.organization_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin','owner','manager','editor')
    )
  );

-- 4) Harden RLS for survey_responses table
alter table public.survey_responses enable row level security;

drop policy if exists "Survey responses service" on public.survey_responses;
drop policy if exists "Survey responses member" on public.survey_responses;
drop policy if exists "Survey responses admin" on public.survey_responses;

drop policy if exists "Survey responses service role" on public.survey_responses;
drop policy if exists "Survey responses own" on public.survey_responses;
drop policy if exists "Survey responses admin manage" on public.survey_responses;

create policy "Survey responses service role"
  on public.survey_responses
  for all
  to service_role
  using (true)
  with check (true);

create policy "Survey responses own"
  on public.survey_responses
  for select
  to authenticated
  using (
    public.survey_responses.user_id = auth.uid()
    or (
      public.survey_responses.organization_id is not null
      and exists (
        select 1
        from public.organization_memberships m
        where m.org_id = public.survey_responses.organization_id
          and m.user_id = auth.uid()
      )
    )
  );

create policy "Survey responses submit"
  on public.survey_responses
  for insert
  to authenticated
  with check (
    public.survey_responses.user_id = auth.uid()
    and (
      public.survey_responses.organization_id is not null
      and exists (
        select 1
        from public.organization_memberships m
        where m.org_id = public.survey_responses.organization_id
          and m.user_id = auth.uid()
      )
    )
  );

create policy "Survey responses admin manage"
  on public.survey_responses
  for all
  to authenticated
  using (
    public.survey_responses.organization_id is not null
    and exists (
      select 1
      from public.organization_memberships m
      where m.org_id = public.survey_responses.organization_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin','owner','manager','editor')
    )
  )
  with check (
    public.survey_responses.organization_id is not null
    and exists (
      select 1
      from public.organization_memberships m
      where m.org_id = public.survey_responses.organization_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin','owner','manager','editor')
    )
  );

-- 5) Survey assignments: ensure RLS enforced with same pattern
alter table public.survey_assignments enable row level security;

drop policy if exists "Survey assignments service role" on public.survey_assignments;
drop policy if exists "Survey assignments member read" on public.survey_assignments;
drop policy if exists "Survey assignments admin manage" on public.survey_assignments;

create policy "Survey assignments service role"
  on public.survey_assignments
  for all
  to service_role
  using (true)
  with check (true);

create policy "Survey assignments member read"
  on public.survey_assignments
  for select
  to authenticated
  using (
    exists (
      select 1
      from unnest(public.survey_assignments.organization_ids) as org_id
      join public.organization_memberships m on m.org_id = org_id
      where m.user_id = auth.uid()
    )
  );

create policy "Survey assignments admin manage"
  on public.survey_assignments
  for all
  to authenticated
  using (
    exists (
      select 1
      from unnest(public.survey_assignments.organization_ids) as org_id
      join public.organization_memberships m on m.org_id = org_id
      where m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin','owner','manager','editor')
    )
  )
  with check (
    exists (
      select 1
      from unnest(public.survey_assignments.organization_ids) as org_id
      join public.organization_memberships m on m.org_id = org_id
      where m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin','owner','manager','editor')
    )
  );
