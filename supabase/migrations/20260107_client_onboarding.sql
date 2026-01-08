-- 2026-01-07 Client onboarding schema
create extension if not exists "uuid-ossp";

-------------------------------------------------------------------------------
-- Organization columns for onboarding metadata
-------------------------------------------------------------------------------
alter table if exists public.organizations
  add column if not exists slug text,
  add column if not exists timezone text default 'UTC',
  add column if not exists onboarding_status text default 'pending';

do $$
declare
  rec record;
  attempted_slug text;
  suffix integer;
begin
  for rec in select id, name, slug from public.organizations loop
    if rec.slug is not null then
      continue;
    end if;
    attempted_slug := regexp_replace(lower(coalesce(rec.name, rec.id::text)), '[^a-z0-9]+', '-', 'g');
    attempted_slug := trim(both '-' from attempted_slug);
    if attempted_slug is null or attempted_slug = '' then
      attempted_slug := left(rec.id::text, 12);
    end if;
    suffix := 1;
    while exists(select 1 from public.organizations where slug = attempted_slug and id <> rec.id) loop
      suffix := suffix + 1;
      attempted_slug := attempted_slug || '-' || suffix::text;
    end loop;
    update public.organizations set slug = attempted_slug where id = rec.id;
  end loop;
end$$;

create unique index if not exists organizations_slug_unique on public.organizations(slug);

-------------------------------------------------------------------------------
-- Org invites
-------------------------------------------------------------------------------
create table if not exists public.org_invites (
  id uuid primary key default uuid_generate_v4(),
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

create index if not exists org_invites_org_idx on public.org_invites(org_id);
create index if not exists org_invites_status_idx on public.org_invites(status);
create index if not exists org_invites_email_idx on public.org_invites(lower(email));

create unique index if not exists org_invites_pending_unique
  on public.org_invites(org_id, lower(email))
  where status in ('pending','sent');

create trigger org_invites_set_updated_at
  before update on public.org_invites
  for each row execute function public.set_updated_at();

-------------------------------------------------------------------------------
-- Activation steps + events
-------------------------------------------------------------------------------
create table if not exists public.org_activation_steps (
  id uuid primary key default uuid_generate_v4(),
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

create trigger org_activation_steps_set_updated_at
  before update on public.org_activation_steps
  for each row execute function public.set_updated_at();

create table if not exists public.org_activation_events (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null default timezone('utc', now()),
  actor_id uuid references auth.users(id),
  actor_email text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists org_activation_events_org_idx on public.org_activation_events(org_id);
create index if not exists org_activation_events_type_idx on public.org_activation_events(event_type);

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

-------------------------------------------------------------------------------
-- Row level security
-------------------------------------------------------------------------------
alter table public.org_invites enable row level security;
alter table public.org_activation_steps enable row level security;
alter table public.org_activation_events enable row level security;

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
  for all
  to authenticated
  using (public._is_org_admin(org_id))
  with check (public._is_org_admin(org_id));

create policy if not exists "org_activation_steps_service_full_access"
  on public.org_activation_steps
  for all
  to service_role
  using (true)
  with check (true);

create policy if not exists "org_activation_steps_member_read"
  on public.org_activation_steps
  for select
  to authenticated
  using (public._is_org_member(org_id));

create policy if not exists "org_activation_steps_admin_manage"
  on public.org_activation_steps
  for all
  to authenticated
  using (public._is_org_admin(org_id))
  with check (public._is_org_admin(org_id));

create policy if not exists "org_activation_events_service_full_access"
  on public.org_activation_events
  for all
  to service_role
  using (true)
  with check (true);

create policy if not exists "org_activation_events_member_read"
  on public.org_activation_events
  for select
  to authenticated
  using (public._is_org_member(org_id));

create policy if not exists "org_activation_events_admin_manage"
  on public.org_activation_events
  for insert, update, delete
  to authenticated
  using (public._is_org_admin(org_id))
  with check (public._is_org_admin(org_id));

-------------------------------------------------------------------------------
-- Convenience grants
-------------------------------------------------------------------------------
grant select, insert, update, delete on public.org_invites to service_role;
grant select on public.org_invites to authenticated;

grant select, insert, update, delete on public.org_activation_steps to service_role;
grant select on public.org_activation_steps to authenticated;

grant select, insert, update, delete on public.org_activation_events to service_role;
grant select on public.org_activation_events to authenticated;
