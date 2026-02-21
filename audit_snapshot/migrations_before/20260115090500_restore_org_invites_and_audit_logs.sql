-- Ensure org_invites and audit_logs exist for onboarding + auditing flows
BEGIN;

create extension if not exists "uuid-ossp";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public._is_org_admin(org_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.org_id = org_id
      and m.user_id = auth.uid()
      and lower(coalesce(m.role, 'member')) in ('admin','owner','manager','editor')
  );
$$;

create or replace function public._is_org_member(org_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.org_id = org_id
      and m.user_id = auth.uid()
  );
$$;

create table if not exists public.org_invites (
  id uuid primary key default uuid_generate_v4(),
  org_id text not null references public.organizations(id) on delete cascade,
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
create index if not exists org_invites_token_idx on public.org_invites(invite_token);

create unique index if not exists org_invites_pending_unique
  on public.org_invites(org_id, lower(email))
  where status in ('pending','sent');

drop trigger if exists org_invites_set_updated_at on public.org_invites;
create trigger org_invites_set_updated_at
  before update on public.org_invites
  for each row execute function public.set_updated_at();

alter table public.org_invites enable row level security;

drop policy if exists "org_invites_service_full_access" on public.org_invites;
create policy "org_invites_service_full_access"
  on public.org_invites
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "org_invites_member_read" on public.org_invites;
create policy "org_invites_member_read"
  on public.org_invites
  for select
  to authenticated
  using (public._is_org_member(org_id));

drop policy if exists "org_invites_admin_manage" on public.org_invites;
create policy "org_invites_admin_manage"
  on public.org_invites
  for all
  to authenticated
  using (public._is_org_admin(org_id))
  with check (public._is_org_admin(org_id));

grant select, insert, update, delete on public.org_invites to service_role;
grant select on public.org_invites to authenticated;

create table if not exists public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  action text not null,
  details jsonb not null default '{}'::jsonb,
  org_id text,
  user_id uuid,
  ip_address text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists audit_logs_org_created_idx on public.audit_logs(org_id, created_at desc);
create index if not exists audit_logs_user_created_idx on public.audit_logs(user_id, created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs(action);

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_service_access on public.audit_logs;
create policy audit_logs_service_access
  on public.audit_logs
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists audit_logs_member_read on public.audit_logs;
create policy audit_logs_member_read
  on public.audit_logs
  for select
  to authenticated
  using (org_id is not null and public._is_org_member(org_id));

grant select, insert, update, delete on public.audit_logs to service_role;
grant select on public.audit_logs to authenticated;

COMMIT;
