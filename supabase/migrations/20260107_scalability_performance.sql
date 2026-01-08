create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-------------------------------------------------------------------------------
-- Organization querying indexes (search + pagination)
-------------------------------------------------------------------------------
create index if not exists organizations_created_desc_idx on public.organizations (created_at desc);
create index if not exists organizations_status_created_idx on public.organizations (status, created_at desc);
create index if not exists organizations_subscription_idx on public.organizations (subscription, created_at desc);
create index if not exists organizations_name_trgm on public.organizations using gin (name gin_trgm_ops);
create index if not exists organizations_contact_trgm on public.organizations using gin (contact_email gin_trgm_ops);

-------------------------------------------------------------------------------
-- Membership + enrollment indexes for large orgs
-------------------------------------------------------------------------------
create index if not exists organization_memberships_org_created_idx on public.organization_memberships(org_id, created_at desc);
create index if not exists organization_memberships_role_idx on public.organization_memberships(org_id, lower(role));
create index if not exists user_course_enrollments_course_enrolled_idx on public.user_course_enrollments(course_id, enrolled_at desc);
create index if not exists user_course_enrollments_course_completed_idx on public.user_course_enrollments(course_id, completed_at desc);

-------------------------------------------------------------------------------
-- Notifications delivery columns + indexes
-------------------------------------------------------------------------------
alter table if exists public.notifications
  add column if not exists dispatch_status text not null default 'pending' check (dispatch_status in ('pending','queued','processing','delivered','failed')),
  add column if not exists channels text[] not null default array['in_app'],
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists scheduled_for timestamptz,
  add column if not exists delivered_at timestamptz;

update public.notifications
set dispatch_status = case when read = true then 'delivered' else 'queued' end
where dispatch_status = 'pending';

create index if not exists notifications_created_desc_idx on public.notifications (created_at desc);
create index if not exists notifications_status_idx on public.notifications (dispatch_status);
create index if not exists notifications_pending_idx on public.notifications (dispatch_status, scheduled_for)
  where dispatch_status in ('pending','queued','processing');

-------------------------------------------------------------------------------
-- Durable audit log storage for compliance
-------------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  action text not null,
  org_id uuid references public.organizations(id) on delete set null,
  user_id uuid,
  details jsonb not null default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists audit_logs_org_created_idx on public.audit_logs(org_id, created_at desc);
create index if not exists audit_logs_user_created_idx on public.audit_logs(user_id, created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs(action);

alter table public.audit_logs enable row level security;

create policy if not exists audit_logs_service_read
  on public.audit_logs
  for select
  to service_role
  using (true);

create policy if not exists audit_logs_service_write
  on public.audit_logs
  for insert
  to service_role
  with check (true);

-------------------------------------------------------------------------------
-- Materialized rollup for dashboard traffic
-------------------------------------------------------------------------------
create materialized view if not exists public.org_enrollment_stats_mv as
select
  c.org_id,
  date_trunc('day', u.enrolled_at) as activity_day,
  count(*) as enrollments,
  count(*) filter (where u.completed_at is not null) as completions
from public.user_course_enrollments u
join public.courses c on c.id = u.course_id
where c.org_id is not null
group by 1, 2;

create unique index if not exists org_enrollment_stats_mv_pk on public.org_enrollment_stats_mv(org_id, activity_day);

grant select on public.org_enrollment_stats_mv to authenticated;
grant select on public.org_enrollment_stats_mv to service_role;

create or replace function public.refresh_org_enrollment_stats_mv()
returns void
language plpgsql
as $$
begin
  refresh materialized view concurrently public.org_enrollment_stats_mv;
end;
$$;

-------------------------------------------------------------------------------
-- Convenience grants
-------------------------------------------------------------------------------
grant select on public.audit_logs to authenticated;

