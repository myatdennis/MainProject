-- =============================================================================
-- Fix: align organization_profiles and user_profiles column names with runtime
-- =============================================================================
-- organization_profiles: prod schema uses "organization_id" as the FK/PK.
--   The runtime was querying .eq('org_id', ...) — that column does not exist.
--   This migration ensures "organization_id" exists and creates a stable PK.
--
-- user_profiles: prod schema uses "id" as the PK.
--   The runtime was querying .eq('user_id', ...) / .in('user_id', ...) — those
--   calls now use "id", matching the actual schema.
--   This migration adds any columns the runtime writes/reads that may be missing.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. organization_profiles — ensure table and correct primary key column exist
-- ----------------------------------------------------------------------------
create table if not exists public.organization_profiles (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  logo_url        text,
  primary_color   text,
  metadata        jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default timezone('utc', now())
);

-- Ensure the primary key column exists (idempotent add if someone renamed it)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'organization_profiles'
      and column_name  = 'organization_id'
  ) then
    alter table public.organization_profiles
      add column organization_id uuid not null
        references public.organizations(id) on delete cascade;
  end if;

  -- Drop stale "org_id" column if it was mistakenly created
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'organization_profiles'
      and column_name  = 'org_id'
  ) then
    -- Only safe to drop if organization_id already holds the data
    -- (copy if needed, then drop)
    begin
      update public.organization_profiles
        set organization_id = org_id::uuid
        where organization_id is null;
    exception when others then
      null; -- organization_id may not be nullable; ignore
    end;
    alter table public.organization_profiles drop column org_id;
  end if;
end $$;

-- Add optional columns the runtime may read/write
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='organization_profiles' and column_name='logo_url') then
    alter table public.organization_profiles add column logo_url text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='organization_profiles' and column_name='primary_color') then
    alter table public.organization_profiles add column primary_color text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='organization_profiles' and column_name='metadata') then
    alter table public.organization_profiles add column metadata jsonb not null default '{}'::jsonb;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='organization_profiles' and column_name='updated_at') then
    alter table public.organization_profiles add column updated_at timestamptz not null default timezone('utc', now());
  end if;
end $$;

-- Primary key (safe to add if missing)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name   = 'organization_profiles'
      and constraint_type = 'PRIMARY KEY'
  ) then
    alter table public.organization_profiles
      add constraint organization_profiles_pkey primary key (organization_id);
  end if;
end $$;

create index if not exists organization_profiles_org_idx
  on public.organization_profiles(organization_id);

-- RLS
alter table public.organization_profiles enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='organization_profiles' and policyname='org_profiles_service_full_access') then
    create policy "org_profiles_service_full_access" on public.organization_profiles for all to service_role using (true) with check (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='organization_profiles' and policyname='org_profiles_member_read') then
    create policy "org_profiles_member_read" on public.organization_profiles
      for select to authenticated
      using (exists (
        select 1 from public.organization_memberships m
        where m.organization_id = organization_profiles.organization_id
          and m.user_id = auth.uid()
      ));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='organization_profiles' and policyname='org_profiles_admin_manage') then
    create policy "org_profiles_admin_manage" on public.organization_profiles
      using (exists (
        select 1 from public.organization_memberships m
        where m.organization_id = organization_profiles.organization_id
          and m.user_id = auth.uid()
          and m.role in ('owner','admin')
      ))
      with check (exists (
        select 1 from public.organization_memberships m
        where m.organization_id = organization_profiles.organization_id
          and m.user_id = auth.uid()
          and m.role in ('owner','admin')
      ));
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2. user_profiles — ensure "id" PK and all runtime-referenced columns exist
-- ----------------------------------------------------------------------------
create table if not exists public.user_profiles (
  id              uuid not null references auth.users(id) on delete cascade,
  email           text not null,
  first_name      text,
  last_name       text,
  role            text not null default 'learner',
  organization_id uuid references public.organizations(id) on delete set null,
  is_active       boolean not null default true,
  is_admin        boolean not null default false,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default timezone('utc', now()),
  updated_at      timestamptz not null default timezone('utc', now())
);

-- Ensure every column the runtime reads/writes is present
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='id') then
    alter table public.user_profiles add column id uuid not null references auth.users(id) on delete cascade;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='email') then
    alter table public.user_profiles add column email text not null default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='first_name') then
    alter table public.user_profiles add column first_name text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='last_name') then
    alter table public.user_profiles add column last_name text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='role') then
    alter table public.user_profiles add column role text not null default 'learner';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='organization_id') then
    alter table public.user_profiles add column organization_id uuid references public.organizations(id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='is_active') then
    alter table public.user_profiles add column is_active boolean not null default true;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='is_admin') then
    alter table public.user_profiles add column is_admin boolean not null default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='metadata') then
    alter table public.user_profiles add column metadata jsonb not null default '{}'::jsonb;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='created_at') then
    alter table public.user_profiles add column created_at timestamptz not null default timezone('utc', now());
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='updated_at') then
    alter table public.user_profiles add column updated_at timestamptz not null default timezone('utc', now());
  end if;
end $$;

-- Drop stale "user_id" alias column if it exists
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'user_profiles'
      and column_name  = 'user_id'
  ) then
    begin
      update public.user_profiles set id = user_id::uuid where id is null;
    exception when others then
      null;
    end;
    alter table public.user_profiles drop column user_id;
  end if;
end $$;

-- Primary key
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name   = 'user_profiles'
      and constraint_type = 'PRIMARY KEY'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_pkey primary key (id);
  end if;
end $$;

create index if not exists user_profiles_id_idx     on public.user_profiles(id);
create index if not exists user_profiles_email_idx  on public.user_profiles(lower(email));
create index if not exists user_profiles_org_idx    on public.user_profiles(organization_id);

-- updated_at trigger
drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- RLS
alter table public.user_profiles enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_profiles' and policyname='user_profiles_service_full_access') then
    create policy "user_profiles_service_full_access" on public.user_profiles for all to service_role using (true) with check (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_profiles' and policyname='user_profiles_owner_read') then
    create policy "user_profiles_owner_read" on public.user_profiles for select to authenticated using (id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_profiles' and policyname='user_profiles_owner_update') then
    create policy "user_profiles_owner_update" on public.user_profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
  end if;
end $$;
