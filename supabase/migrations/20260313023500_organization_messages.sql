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

-- Add org_id column if table already existed without it
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'organization_messages'
      and column_name  = 'org_id'
  ) then
    alter table public.organization_messages
      add column org_id uuid references public.organizations(id) on delete cascade;
  end if;
end $$;

create index if not exists organization_messages_org_id_idx on public.organization_messages(org_id) where org_id is not null;
create index if not exists organization_messages_sent_at_idx on public.organization_messages(sent_at);

drop trigger if exists organization_messages_set_updated_at on public.organization_messages;
create trigger organization_messages_set_updated_at
  before update on public.organization_messages
  for each row execute function public.set_updated_at();

alter table public.organization_messages enable row level security;

drop policy if exists "organization_messages_service_full_access" on public.organization_messages;
create policy "organization_messages_service_full_access"
  on public.organization_messages
  for all
  to service_role
  using (true)
  with check (true);

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='organization_messages' and policyname='organization_messages_admin_manage') then
    create policy "organization_messages_admin_manage"
      on public.organization_messages
      for all to authenticated
      using (exists (
        select 1 from public.organization_memberships m
        where m.organization_id = organization_messages.org_id
          and m.user_id = auth.uid()
          and m.role in ('owner','admin')
      ))
      with check (exists (
        select 1 from public.organization_memberships m
        where m.organization_id = organization_messages.org_id
          and m.user_id = auth.uid()
          and m.role in ('owner','admin')
      ));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='organization_messages' and policyname='organization_messages_member_read') then
    create policy "organization_messages_member_read"
      on public.organization_messages
      for select to authenticated
      using (exists (
        select 1 from public.organization_memberships m
        where m.organization_id = organization_messages.org_id
          and m.user_id = auth.uid()
      ));
  end if;
end $$;
