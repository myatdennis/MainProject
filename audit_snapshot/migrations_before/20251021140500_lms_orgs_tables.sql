create extension if not exists "uuid-ossp";

create table if not exists public.organizations (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  type text,
  description text,
  logo text,
  contact_person text,
  contact_email text not null,
  contact_phone text,
  website text,
  address text,
  city text,
  state text,
  country text,
  postal_code text,
  subscription text not null,
  billing_email text,
  billing_cycle text,
  custom_pricing numeric,
  max_learners integer,
  max_courses integer,
  max_storage integer,
  features jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  enrollment_date timestamptz,
  contract_start timestamptz,
  contract_end timestamptz,
  total_learners integer not null default 0,
  active_learners integer not null default 0,
  completion_rate numeric(5,2) not null default 0,
  cohorts jsonb not null default '[]'::jsonb,
  last_activity timestamptz,
  modules jsonb not null default '{}'::jsonb,
  notes text,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organizations_status_idx on public.organizations(status);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'organizations_set_updated_at') then
    create trigger organizations_set_updated_at
    before update on public.organizations
    for each row execute function public.set_updated_at();
  end if;
end$$;
