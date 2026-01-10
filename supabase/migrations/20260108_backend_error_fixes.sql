-- 2026-01-08 backend error fixes
-- * Restore user_organizations_vw so membership queries resolve
-- * Allow analytics ingestion to store arbitrary client event ids

BEGIN;

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

alter table if exists public.analytics_events
  add column if not exists client_event_id text;

create unique index if not exists analytics_events_client_event_id_key
  on public.analytics_events(client_event_id)
  where client_event_id is not null;

COMMIT;
