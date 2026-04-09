create extension if not exists "pgcrypto";

-- Ensure the documents table has the expected columns used by the application.
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  category text not null default 'general',
  description text,
  filename text,
  file_url text,
  storage_path text,
  bucket text,
  file_type text,
  file_size bigint,
  visibility text not null default 'global',
  organization_id uuid references public.organizations(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  url_expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Add any missing document columns in older deployments.
do $$
declare
  constraint_name text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'documents' and column_name = 'filename'
  ) then
    alter table public.documents add column filename text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'documents' and column_name = 'description'
  ) then
    alter table public.documents add column description text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'documents' and column_name = 'file_url'
  ) then
    alter table public.documents add column file_url text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'documents' and column_name = 'storage_path'
  ) then
    alter table public.documents add column storage_path text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'documents' and column_name = 'bucket'
  ) then
    alter table public.documents add column bucket text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'documents' and column_name = 'file_type'
  ) then
    alter table public.documents add column file_type text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'documents' and column_name = 'file_size'
  ) then
    alter table public.documents add column file_size bigint;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'documents' and column_name = 'visibility'
  ) then
    alter table public.documents add column visibility text not null default 'global';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'documents' and column_name = 'organization_id'
  ) then
    alter table public.documents add column organization_id uuid references public.organizations(id) on delete set null;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'documents' and column_name = 'user_id'
  ) then
    alter table public.documents add column user_id uuid references auth.users(id) on delete set null;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'documents' and column_name = 'tags'
  ) then
    alter table public.documents add column tags text[] not null default '{}';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'documents' and column_name = 'metadata'
  ) then
    alter table public.documents add column metadata jsonb not null default '{}'::jsonb;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'documents' and column_name = 'created_by'
  ) then
    alter table public.documents add column created_by uuid references auth.users(id) on delete set null;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'documents' and column_name = 'url_expires_at'
  ) then
    alter table public.documents add column url_expires_at timestamptz;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'documents' and column_name = 'updated_at'
  ) then
    alter table public.documents add column updated_at timestamptz not null default timezone('utc', now());
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'documents' and column_name = 'org_id'
  ) then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'documents' and column_name = 'organization_id'
    ) then
      alter table public.documents add column organization_id uuid references public.organizations(id) on delete set null;
    end if;
    update public.documents
    set organization_id = org_id::uuid
    where organization_id is null and org_id is not null
      and org_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'documents' and column_name = 'url'
  ) then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'documents' and column_name = 'file_url'
    ) then
      alter table public.documents add column file_url text;
    end if;
    update public.documents
    set file_url = url
    where file_url is null and url is not null;
  end if;

  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.documents'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%visibility in (''global'',''org'')%'
  loop
    execute format('alter table public.documents drop constraint %I', constraint_name);
  end loop;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.documents'::regclass
      and contype = 'c'
      and conname = 'documents_visibility_check'
  ) then
    alter table public.documents add constraint documents_visibility_check
      check (visibility in ('global', 'org', 'user'));
  end if;
end $$;

create index if not exists documents_category_idx      on public.documents(category);
create index if not exists documents_visibility_idx    on public.documents(visibility);
create index if not exists documents_organization_idx  on public.documents(organization_id) where organization_id is not null;
create index if not exists documents_user_idx          on public.documents(user_id) where user_id is not null;
create index if not exists documents_created_at_idx    on public.documents(created_at desc);
