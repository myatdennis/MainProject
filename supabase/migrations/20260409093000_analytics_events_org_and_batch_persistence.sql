-- Align analytics_events schema with server ingestion + batching.
-- Adds org scoping + idempotency for client-side batched analytics.

begin;

create extension if not exists "uuid-ossp";

alter table public.analytics_events
  add column if not exists org_id uuid references public.organizations(id) on delete set null;

alter table public.analytics_events
  add column if not exists client_event_id text;

create unique index if not exists analytics_events_client_event_id_unique
  on public.analytics_events(client_event_id)
  where client_event_id is not null;

create index if not exists analytics_events_org_created_idx
  on public.analytics_events(org_id, created_at desc);

commit;

