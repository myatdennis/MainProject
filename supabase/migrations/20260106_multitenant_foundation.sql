-- 2026-01-06 Multi-tenant foundation: org RLS, membership canon, helper views
create extension if not exists "uuid-ossp";

-------------------------------------------------------------------------------
-- Helper function: current request user id from JWT claims
-------------------------------------------------------------------------------
create or replace function public._current_request_user_id()
returns uuid
language plpgsql
stable
as $$
declare
  claims json;
  subj text;
begin
  begin
    claims := current_setting('request.jwt.claims', true)::json;
  exception when others then
    return null;
  end;
  if claims ? 'sub' then
    subj := claims->>'sub';
    if subj is not null and subj <> '' then
      return subj::uuid;
    end if;
  end if;
  return null;
end;
$$;

-------------------------------------------------------------------------------
-- Organizations RLS
-------------------------------------------------------------------------------
alter table if exists public.organizations enable row level security;

drop policy if exists "organizations_service" on public.organizations;
drop policy if exists "organizations_member" on public.organizations;
drop policy if exists "organizations_admin" on public.organizations;

drop policy if exists "org_service_full_access" on public.organizations;
drop policy if exists "org_member_read" on public.organizations;
drop policy if exists "org_admin_manage" on public.organizations;

create policy "org_service_full_access"
  on public.organizations
  for all
  to service_role
  using (true)
  with check (true);

create policy "org_member_read"
  on public.organizations
  for select
  to authenticated
  using (
    public._is_org_member(public.organizations.id)
  );

create policy "org_admin_manage"
  on public.organizations
  for all
  to authenticated
  using (public._is_org_admin(public.organizations.id))
  with check (public._is_org_admin(public.organizations.id));

-------------------------------------------------------------------------------
-- Organization memberships canonicalization
-------------------------------------------------------------------------------
alter table if exists public.organization_memberships
  add column if not exists status text not null default 'pending' check (status in ('pending','active','revoked')),
  add column if not exists invited_email text,
  add column if not exists accepted_at timestamptz,
  add column if not exists last_seen_at timestamptz;

update public.organization_memberships
set status = 'active'
where status is null or status = '';

create index if not exists organization_memberships_status_idx
  on public.organization_memberships(status);

create index if not exists organization_memberships_org_status_idx
  on public.organization_memberships(org_id, status);

-------------------------------------------------------------------------------
-- Organization-aware helper views
-------------------------------------------------------------------------------
create or replace view public.organization_membership_vw as
select
  m.id,
  m.org_id,
  m.user_id,
  m.role,
  m.status,
  m.invited_email,
  m.invited_by,
  m.accepted_at,
  m.last_seen_at,
  m.created_at,
  m.updated_at,
  u.email as user_email,
  u.raw_user_meta_data as user_metadata,
  up.first_name,
  up.last_name,
  up.organization_id as profile_org_id
from public.organization_memberships m
left join auth.users u on u.id = m.user_id
left join public.user_profiles up on up.user_id = m.user_id;

grant select on public.organization_membership_vw to authenticated;

grant select on public.organization_membership_vw to service_role;

create or replace view public.user_organizations_vw as
select
  m.user_id,
  m.org_id as organization_id,
  m.role,
  m.status,
  o.name as organization_name,
  o.status as organization_status,
  o.subscription,
  o.features,
  m.accepted_at,
  m.last_seen_at
from public.organization_memberships m
join public.organizations o on o.id = m.org_id;

grant select on public.user_organizations_vw to authenticated;

grant select on public.user_organizations_vw to service_role;

-------------------------------------------------------------------------------
-- Default owner membership trigger
-------------------------------------------------------------------------------
create or replace function public.create_owner_membership_for_org()
returns trigger
language plpgsql
security definer
as $$
declare
  actor uuid;
begin
  actor := public._current_request_user_id();
  if actor is null then
    return new;
  end if;

  insert into public.organization_memberships (org_id, user_id, role, status, invited_by, accepted_at)
  values (new.id, actor, 'owner', 'active', actor, now())
  on conflict (org_id, user_id)
  do update set
    role = excluded.role,
    status = 'active',
    accepted_at = coalesce(organization_memberships.accepted_at, now());

  return new;
end;
$$;

create trigger organizations_create_owner_membership
  after insert on public.organizations
  for each row execute function public.create_owner_membership_for_org();

-------------------------------------------------------------------------------
-- Convenience org_id indexes for frequently accessed tables
-------------------------------------------------------------------------------
create index if not exists courses_organization_id_idx on public.courses(organization_id);
create index if not exists assignments_organization_id_idx on public.assignments(organization_id);
create index if not exists surveys_organization_id_idx on public.surveys(organization_id);
create index if not exists certificates_organization_id_idx on public.certificates(organization_id);
create index if not exists notifications_organization_id_idx on public.notifications(org_id);
create index if not exists org_workspace_strategic_plans_org_idx on public.org_workspace_strategic_plans(org_id);
create index if not exists org_workspace_session_notes_org_idx on public.org_workspace_session_notes(org_id);
create index if not exists org_workspace_action_items_org_idx on public.org_workspace_action_items(org_id);

-------------------------------------------------------------------------------
-- Ensure helper grants exist for service/auth roles
-------------------------------------------------------------------------------
grant execute on function public._current_request_user_id to authenticated, service_role;
grant execute on function public.create_owner_membership_for_org to authenticated, service_role;
