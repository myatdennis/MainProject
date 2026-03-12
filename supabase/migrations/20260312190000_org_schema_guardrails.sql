-- Ensure the organizations table exposes every column referenced by the runtime.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'type') then
    alter table public.organizations add column type text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'description') then
    alter table public.organizations add column description text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'logo') then
    alter table public.organizations add column logo text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'contact_person') then
    alter table public.organizations add column contact_person text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'contact_email') then
    alter table public.organizations add column contact_email text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'contact_phone') then
    alter table public.organizations add column contact_phone text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'website') then
    alter table public.organizations add column website text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'address') then
    alter table public.organizations add column address text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'city') then
    alter table public.organizations add column city text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'state') then
    alter table public.organizations add column state text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'country') then
    alter table public.organizations add column country text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'postal_code') then
    alter table public.organizations add column postal_code text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'subscription') then
    alter table public.organizations add column subscription text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'billing_email') then
    alter table public.organizations add column billing_email text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'billing_cycle') then
    alter table public.organizations add column billing_cycle text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'custom_pricing') then
    alter table public.organizations add column custom_pricing numeric;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'max_learners') then
    alter table public.organizations add column max_learners integer;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'max_courses') then
    alter table public.organizations add column max_courses integer;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'max_storage') then
    alter table public.organizations add column max_storage integer;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'features') then
    alter table public.organizations add column features jsonb not null default '{}'::jsonb;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'settings') then
    alter table public.organizations add column settings jsonb not null default '{}'::jsonb;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'status') then
    alter table public.organizations add column status text not null default 'active';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'enrollment_date') then
    alter table public.organizations add column enrollment_date date;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'contract_start') then
    alter table public.organizations add column contract_start timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'contract_end') then
    alter table public.organizations add column contract_end timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'total_learners') then
    alter table public.organizations add column total_learners integer not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'active_learners') then
    alter table public.organizations add column active_learners integer not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'completion_rate') then
    alter table public.organizations add column completion_rate numeric not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'cohorts') then
    alter table public.organizations add column cohorts jsonb not null default '[]'::jsonb;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'last_activity') then
    alter table public.organizations add column last_activity timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'modules') then
    alter table public.organizations add column modules jsonb not null default '{}'::jsonb;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'notes') then
    alter table public.organizations add column notes text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'tags') then
    alter table public.organizations add column tags text[] not null default array[]::text[];
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'onboarding_status') then
    alter table public.organizations add column onboarding_status text not null default 'pending';
  end if;
end $$;

-------------------------------------------------------------------------------
-- Org invites (guarantee runtime columns exist)
-------------------------------------------------------------------------------
create table if not exists public.org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  invite_token text not null,
  role text not null default 'member',
  status text not null default 'pending' check (status in ('pending','sent','accepted','revoked','expired','bounced')),
  inviter_id uuid references auth.users(id),
  inviter_email text,
  invited_name text,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  last_sent_at timestamptz,
  reminder_count integer not null default 0,
  duplicate_of uuid references public.org_invites(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'org_invites' and column_name = 'org_id') then
    alter table public.org_invites add column org_id uuid not null references public.organizations(id) on delete cascade;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'org_invites' and column_name = 'invite_token') then
    alter table public.org_invites add column invite_token text not null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'org_invites' and column_name = 'inviter_email') then
    alter table public.org_invites add column inviter_email text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'org_invites' and column_name = 'invited_name') then
    alter table public.org_invites add column invited_name text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'org_invites' and column_name = 'metadata') then
    alter table public.org_invites add column metadata jsonb not null default '{}'::jsonb;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'org_invites' and column_name = 'expires_at') then
    alter table public.org_invites add column expires_at timestamptz not null default timezone('utc', now()) + interval '3 days';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'org_invites' and column_name = 'last_sent_at') then
    alter table public.org_invites add column last_sent_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'org_invites' and column_name = 'reminder_count') then
    alter table public.org_invites add column reminder_count integer not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'org_invites' and column_name = 'duplicate_of') then
    alter table public.org_invites add column duplicate_of uuid references public.org_invites(id) on delete set null;
  end if;
end $$;

create index if not exists org_invites_org_idx on public.org_invites(org_id);
create index if not exists org_invites_status_idx on public.org_invites(status);
create index if not exists org_invites_email_idx on public.org_invites(lower(email));
create index if not exists org_invites_token_idx on public.org_invites(invite_token);

create unique index if not exists org_invites_pending_unique
  on public.org_invites(org_id, lower(email))
  where status in ('pending','sent');

drop trigger if exists org_invites_set_updated_at on public.org_invites;
create trigger org_invites_set_updated_at
  before update on public.org_invites
  for each row execute function public.set_updated_at();

alter table public.org_invites enable row level security;

create policy if not exists "org_invites_service_full_access"
  on public.org_invites
  for all
  to service_role
  using (true)
  with check (true);

create policy if not exists "org_invites_member_read"
  on public.org_invites
  for select
  to authenticated
  using (public._is_org_member(org_id));

create policy if not exists "org_invites_admin_manage"
  on public.org_invites
  using (public._is_org_admin(org_id))
  with check (public._is_org_admin(org_id));

-------------------------------------------------------------------------------
-- Activation steps & events (used for onboarding progress)
-------------------------------------------------------------------------------
create table if not exists public.org_activation_steps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  step text not null,
  status text not null default 'pending' check (status in ('pending','in_progress','completed','blocked')),
  description text,
  completed_at timestamptz,
  actor_id uuid references auth.users(id),
  actor_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (org_id, step)
);

drop trigger if exists org_activation_steps_set_updated_at on public.org_activation_steps;
create trigger org_activation_steps_set_updated_at
  before update on public.org_activation_steps
  for each row execute function public.set_updated_at();

create table if not exists public.org_activation_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null default timezone('utc', now()),
  actor_id uuid references auth.users(id),
  actor_email text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists org_activation_events_org_idx on public.org_activation_events(org_id);
create index if not exists org_activation_events_type_idx on public.org_activation_events(event_type);

alter table public.org_activation_steps enable row level security;
alter table public.org_activation_events enable row level security;

create policy if not exists "org_activation_steps_service_full_access"
  on public.org_activation_steps
  for all
  to service_role
  using (true)
  with check (true);

create policy if not exists "org_activation_events_service_full_access"
  on public.org_activation_events
  for all
  to service_role
  using (true)
  with check (true);

-------------------------------------------------------------------------------
-- Progress view aggregates
-------------------------------------------------------------------------------
create or replace view public.org_onboarding_progress_vw as
with step_counts as (
  select
    org_id,
    count(*) as total_steps,
    count(*) filter (where status = 'completed') as completed_steps,
    min(created_at) filter (where step = 'org_created') as org_created_at,
    max(completed_at) filter (where step = 'first_login') as first_login_at
  from public.org_activation_steps
  group by org_id
), invite_counts as (
  select
    org_id,
    count(*) filter (where status in ('pending','sent')) as pending_invites,
    count(*) filter (where status = 'accepted') as accepted_invites,
    count(*) filter (where status = 'pending' and created_at < timezone('utc', now()) - interval '7 days') as stale_invites,
    max(last_sent_at) as last_sent_at
  from public.org_invites
  group by org_id
)
select
  o.id as org_id,
  o.name as org_name,
  coalesce(sc.total_steps, 0) as total_steps,
  coalesce(sc.completed_steps, 0) as completed_steps,
  coalesce(ic.pending_invites, 0) as pending_invites,
  coalesce(ic.accepted_invites, 0) as accepted_invites,
  coalesce(ic.stale_invites, 0) as stale_invites,
  ic.last_sent_at,
  sc.org_created_at,
  sc.first_login_at
from public.organizations o
left join step_counts sc on sc.org_id = o.id
left join invite_counts ic on ic.org_id = o.id;

grant select on public.org_onboarding_progress_vw to authenticated;
grant select on public.org_onboarding_progress_vw to service_role;
