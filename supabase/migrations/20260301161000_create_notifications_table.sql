-- Notifications table ensures learner/admin portals can fetch notifications without schema errors.
create extension if not exists "pgcrypto";

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  type text not null default 'announcement',
  title text not null,
  body text,
  read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  meta jsonb not null default '{}'::jsonb,
  dispatch_status text not null default 'queued',
  channels text[] not null default array['in_app']::text[],
  scheduled_for timestamptz,
  delivered_at timestamptz
);

create or replace function public.notifications_sync_org_columns()
returns trigger
language plpgsql
as $$
begin
  if new.org_id is null and new.organization_id is not null then
    new.org_id := new.organization_id;
  elsif new.organization_id is null and new.org_id is not null then
    new.organization_id := new.org_id;
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_sync_org_columns on public.notifications;
create trigger notifications_sync_org_columns
before insert or update on public.notifications
for each row execute function public.notifications_sync_org_columns();

create index if not exists notifications_user_id_idx on public.notifications (user_id);
create index if not exists notifications_org_id_idx on public.notifications (org_id);
create index if not exists notifications_created_at_idx on public.notifications (created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Notifications select for owner" on public.notifications;
create policy "Notifications select for owner" on public.notifications
for select
using (user_id = auth.uid());

drop policy if exists "Notifications update read flag" on public.notifications;
create policy "Notifications update read flag" on public.notifications
for update
using (user_id = auth.uid())
with check (true);
