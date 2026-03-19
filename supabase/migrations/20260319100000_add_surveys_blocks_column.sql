-- =============================================================================
-- Fix: Add missing `blocks` column to public.surveys
-- =============================================================================
-- The server's buildSurveyPersistencePayload function writes a `blocks` field
-- but the surveys table was created without this column, causing a 500 on every
-- survey save/upsert/update request with the Supabase schema cache error:
--   "column 'blocks' of relation 'surveys' does not exist"
-- =============================================================================

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'surveys'
      and column_name  = 'blocks'
  ) then
    alter table public.surveys
      add column blocks jsonb not null default '[]'::jsonb;
  end if;
end $$;

-- Also ensure other columns the runtime expects are present
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='surveys' and column_name='version') then
    alter table public.surveys add column version integer not null default 1;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='surveys' and column_name='default_language') then
    alter table public.surveys add column default_language text not null default 'en';
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='surveys' and column_name='supported_languages') then
    alter table public.surveys add column supported_languages text[] not null default '{en}';
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='surveys' and column_name='completion_settings') then
    alter table public.surveys add column completion_settings jsonb not null default '{"thankYouMessage":"Thank you for completing our survey!","showResources":false,"recommendedCourses":[]}'::jsonb;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='surveys' and column_name='reflection_prompts') then
    alter table public.surveys add column reflection_prompts jsonb not null default '[]'::jsonb;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='surveys' and column_name='organization_id') then
    alter table public.surveys add column organization_id uuid references public.organizations(id) on delete set null;
  end if;
end $$;

create index if not exists surveys_org_idx on public.surveys(organization_id) where organization_id is not null;
