-- Organization messaging log to track outbound communications
create table if not exists public.organization_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  subject text not null,
  body text not null,
  recipient_email text not null,
  recipient_name text,
  recipient_role text,
  contact_id uuid references public.organization_contacts(id) on delete set null,
  sent_by uuid,
  sent_by_email text,
  sent_by_name text,
  channel text not null default 'email',
  status text not null default 'queued' check (status in ('queued','sending','sent','failed')),
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists organization_messages_org_id_idx on public.organization_messages(org_id);
create index if not exists organization_messages_sent_at_idx on public.organization_messages(sent_at);

drop trigger if exists organization_messages_set_updated_at on public.organization_messages;
create trigger organization_messages_set_updated_at
  before update on public.organization_messages
  for each row execute function public.set_updated_at();

alter table public.organization_messages enable row level security;

create policy if not exists "organization_messages_service_full_access"
  on public.organization_messages
  for all
  to service_role
  using (true)
  with check (true);

create policy if not exists "organization_messages_admin_manage"
  on public.organization_messages
  for all
  to authenticated
  using (public._is_org_admin(org_id))
  with check (public._is_org_admin(org_id));

create policy if not exists "organization_messages_member_read"
  on public.organization_messages
  for select
  to authenticated
  using (public._is_org_member(org_id));
