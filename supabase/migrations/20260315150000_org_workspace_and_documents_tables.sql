-- =============================================================================
-- Create org workspace tables: strategic_plans and action_items
-- These are referenced by /api/orgs/:orgId/workspace routes but were never
-- migrated to prod, causing PGRST205 "table not found" errors.
-- =============================================================================

-- Strategic plans
create table if not exists public.org_workspace_strategic_plans (
  id          uuid        primary key default gen_random_uuid(),
  org_id      uuid        not null references public.organizations(id) on delete cascade,
  title       text        not null,
  description text,
  status      text        not null default 'active'
                check (status in ('active','archived','draft')),
  priority    text        not null default 'medium'
                check (priority in ('low','medium','high')),
  due_date    date,
  owner_id    uuid        references auth.users(id) on delete set null,
  metadata    jsonb       not null default '{}'::jsonb,
  created_by  uuid        references auth.users(id) on delete set null,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

create index if not exists org_workspace_strategic_plans_org_idx
  on public.org_workspace_strategic_plans(org_id);
create index if not exists org_workspace_strategic_plans_status_idx
  on public.org_workspace_strategic_plans(status);

drop trigger if exists org_workspace_strategic_plans_set_updated_at
  on public.org_workspace_strategic_plans;
create trigger org_workspace_strategic_plans_set_updated_at
  before update on public.org_workspace_strategic_plans
  for each row execute function public.set_updated_at();

alter table public.org_workspace_strategic_plans enable row level security;

drop policy if exists "org_workspace_strategic_plans_service_full_access"
  on public.org_workspace_strategic_plans;
create policy "org_workspace_strategic_plans_service_full_access"
  on public.org_workspace_strategic_plans
  for all to service_role
  using (true) with check (true);

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'org_workspace_strategic_plans'
      and policyname = 'org_workspace_strategic_plans_member_access'
  ) then
    create policy "org_workspace_strategic_plans_member_access"
      on public.org_workspace_strategic_plans
      for all to authenticated
      using (exists (
        select 1 from public.organization_memberships m
        where m.organization_id = org_workspace_strategic_plans.org_id
          and m.user_id = auth.uid()
      ))
      with check (exists (
        select 1 from public.organization_memberships m
        where m.organization_id = org_workspace_strategic_plans.org_id
          and m.user_id = auth.uid()
      ));
  end if;
end $$;

-- Session notes
create table if not exists public.org_workspace_session_notes (
  id          uuid        primary key default gen_random_uuid(),
  org_id      uuid        not null references public.organizations(id) on delete cascade,
  title       text,
  content     text        not null default '',
  note_date   date        not null default current_date,
  author_id   uuid        references auth.users(id) on delete set null,
  metadata    jsonb       not null default '{}'::jsonb,
  created_by  uuid        references auth.users(id) on delete set null,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

create index if not exists org_workspace_session_notes_org_idx
  on public.org_workspace_session_notes(org_id);
create index if not exists org_workspace_session_notes_date_idx
  on public.org_workspace_session_notes(note_date desc);

drop trigger if exists org_workspace_session_notes_set_updated_at
  on public.org_workspace_session_notes;
create trigger org_workspace_session_notes_set_updated_at
  before update on public.org_workspace_session_notes
  for each row execute function public.set_updated_at();

alter table public.org_workspace_session_notes enable row level security;

drop policy if exists "org_workspace_session_notes_service_full_access"
  on public.org_workspace_session_notes;
create policy "org_workspace_session_notes_service_full_access"
  on public.org_workspace_session_notes
  for all to service_role
  using (true) with check (true);

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'org_workspace_session_notes'
      and policyname = 'org_workspace_session_notes_member_access'
  ) then
    create policy "org_workspace_session_notes_member_access"
      on public.org_workspace_session_notes
      for all to authenticated
      using (exists (
        select 1 from public.organization_memberships m
        where m.organization_id = org_workspace_session_notes.org_id
          and m.user_id = auth.uid()
      ))
      with check (exists (
        select 1 from public.organization_memberships m
        where m.organization_id = org_workspace_session_notes.org_id
          and m.user_id = auth.uid()
      ));
  end if;
end $$;

-- Action items
create table if not exists public.org_workspace_action_items (
  id           uuid        primary key default gen_random_uuid(),
  org_id       uuid        not null references public.organizations(id) on delete cascade,
  plan_id      uuid        references public.org_workspace_strategic_plans(id) on delete set null,
  title        text        not null,
  description  text,
  status       text        not null default 'open'
                 check (status in ('open','in_progress','done','cancelled')),
  priority     text        not null default 'medium'
                 check (priority in ('low','medium','high')),
  assignee_id  uuid        references auth.users(id) on delete set null,
  due_date     date,
  metadata     jsonb       not null default '{}'::jsonb,
  created_by   uuid        references auth.users(id) on delete set null,
  created_at   timestamptz not null default timezone('utc', now()),
  updated_at   timestamptz not null default timezone('utc', now())
);

create index if not exists org_workspace_action_items_org_idx
  on public.org_workspace_action_items(org_id);
create index if not exists org_workspace_action_items_plan_idx
  on public.org_workspace_action_items(plan_id)
  where plan_id is not null;
create index if not exists org_workspace_action_items_status_idx
  on public.org_workspace_action_items(status);

drop trigger if exists org_workspace_action_items_set_updated_at
  on public.org_workspace_action_items;
create trigger org_workspace_action_items_set_updated_at
  before update on public.org_workspace_action_items
  for each row execute function public.set_updated_at();

alter table public.org_workspace_action_items enable row level security;

drop policy if exists "org_workspace_action_items_service_full_access"
  on public.org_workspace_action_items;
create policy "org_workspace_action_items_service_full_access"
  on public.org_workspace_action_items
  for all to service_role
  using (true) with check (true);

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'org_workspace_action_items'
      and policyname = 'org_workspace_action_items_member_access'
  ) then
    create policy "org_workspace_action_items_member_access"
      on public.org_workspace_action_items
      for all to authenticated
      using (exists (
        select 1 from public.organization_memberships m
        where m.organization_id = org_workspace_action_items.org_id
          and m.user_id = auth.uid()
      ))
      with check (exists (
        select 1 from public.organization_memberships m
        where m.organization_id = org_workspace_action_items.org_id
          and m.user_id = auth.uid()
      ));
  end if;
end $$;

-- =============================================================================
-- Ensure documents table exists (referenced by /api/admin/documents routes)
-- =============================================================================
create table if not exists public.documents (
  id              uuid        primary key default gen_random_uuid(),
  name            text        not null,
  category        text        not null,
  description     text,
  file_url        text,
  storage_path    text,
  bucket          text,
  file_type       text,
  file_size       bigint,
  visibility      text        not null default 'global'
                    check (visibility in ('global','org')),
  organization_id uuid        references public.organizations(id) on delete set null,
  user_id         uuid        references auth.users(id) on delete set null,
  tags            text[]      not null default '{}',
  metadata        jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default timezone('utc', now()),
  updated_at      timestamptz not null default timezone('utc', now())
);

-- Add any missing columns if the table already existed without them
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='documents' and column_name='visibility') then
    alter table public.documents add column visibility text not null default 'global';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='documents' and column_name='organization_id') then
    alter table public.documents add column organization_id uuid references public.organizations(id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='documents' and column_name='user_id') then
    alter table public.documents add column user_id uuid references auth.users(id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='documents' and column_name='tags') then
    alter table public.documents add column tags text[] not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='documents' and column_name='metadata') then
    alter table public.documents add column metadata jsonb not null default '{}'::jsonb;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='documents' and column_name='description') then
    alter table public.documents add column description text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='documents' and column_name='file_url') then
    alter table public.documents add column file_url text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='documents' and column_name='storage_path') then
    alter table public.documents add column storage_path text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='documents' and column_name='bucket') then
    alter table public.documents add column bucket text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='documents' and column_name='file_type') then
    alter table public.documents add column file_type text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='documents' and column_name='file_size') then
    alter table public.documents add column file_size bigint;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='documents' and column_name='category') then
    alter table public.documents add column category text not null default 'general';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='documents' and column_name='name') then
    alter table public.documents add column name text not null default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='documents' and column_name='updated_at') then
    alter table public.documents add column updated_at timestamptz not null default timezone('utc', now());
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='documents' and column_name='created_at') then
    alter table public.documents add column created_at timestamptz not null default timezone('utc', now());
  end if;
end $$;

create index if not exists documents_category_idx      on public.documents(category);
create index if not exists documents_visibility_idx    on public.documents(visibility);
create index if not exists documents_organization_idx  on public.documents(organization_id) where organization_id is not null;
create index if not exists documents_user_idx          on public.documents(user_id) where user_id is not null;
create index if not exists documents_created_at_idx    on public.documents(created_at desc);

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

alter table public.documents enable row level security;

drop policy if exists "documents_service_full_access" on public.documents;
create policy "documents_service_full_access"
  on public.documents for all to service_role
  using (true) with check (true);

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'documents'
      and policyname = 'documents_authenticated_read'
  ) then
    create policy "documents_authenticated_read"
      on public.documents
      for select to authenticated
      using (
        visibility = 'global'
        or organization_id is null
        or exists (
          select 1 from public.organization_memberships m
          where m.organization_id = documents.organization_id
            and m.user_id = auth.uid()
        )
      );
  end if;
end $$;
