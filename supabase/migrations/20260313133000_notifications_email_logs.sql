-- Phase 1 foundation: normalize notifications schema and introduce email/message logs.
create extension if not exists "pgcrypto";

-- 1) Ensure notifications table matches the updated contract.
alter table public.notifications
  add column if not exists recipient_type text,
  add column if not exists recipient_id uuid,
  add column if not exists link text,
  add column if not exists channel text,
  add column if not exists status text,
  add column if not exists priority text,
  add column if not exists metadata jsonb,
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists message text;

alter table public.notifications
  alter column metadata set default '{}'::jsonb,
  alter column metadata set not null,
  alter column channel set default 'in_app',
  alter column status set default 'unread',
  alter column priority set default 'normal';

do $$
begin
  begin
    alter table public.notifications
      add constraint notifications_recipient_type_check
        check (recipient_type in ('user','organization'));
  exception
    when duplicate_object then null;
  end;

  begin
    alter table public.notifications
      add constraint notifications_status_check
        check (status in ('unread','read'));
  exception
    when duplicate_object then null;
  end;

  begin
    alter table public.notifications
      add constraint notifications_priority_check
        check (priority in ('low','normal','high'));
  exception
    when duplicate_object then null;
  end;

  begin
    alter table public.notifications
      add constraint notifications_channel_check
        check (channel in ('in_app','email','both'));
  exception
    when duplicate_object then null;
  end;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notifications' and column_name = 'meta'
  ) then
    update public.notifications
      set metadata = coalesce(metadata, meta, '{}'::jsonb)
      where metadata is null
        or metadata = '{}'::jsonb;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notifications' and column_name = 'body'
  ) then
    update public.notifications
      set message = coalesce(message, body),
          body     = coalesce(body, message)
      where coalesce(message, body) is not null;
  end if;
end $$;

update public.notifications
  set recipient_type = case
        when user_id is not null then 'user'
        when coalesce(organization_id, org_id) is not null then 'organization'
        else coalesce(recipient_type, 'user')
      end,
      recipient_id = case
        when user_id is not null then user_id
        when coalesce(organization_id, org_id) is not null then coalesce(organization_id, org_id)
        else recipient_id
      end
  where recipient_type is null
     or recipient_id is null;

update public.notifications
  set status = case when coalesce(read, false) then 'read' else 'unread' end,
      read_at = case
        when coalesce(read, false) and read_at is null then timezone('utc', now())
        when not coalesce(read, false) then null
        else read_at
      end
  where status is null
     or (coalesce(read, false) and status <> 'read')
     or (not coalesce(read, false) and status <> 'unread');

update public.notifications
  set channel = case
        when channel is not null then channel
        when channels @> array['email','in_app'] then 'both'
        when channels @> array['email'] then 'email'
        else 'in_app'
      end
  where channel is null;

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_type, recipient_id);
create index if not exists notifications_status_idx
  on public.notifications (status);
create index if not exists notifications_created_at_desc_idx
  on public.notifications (created_at desc);

-- Replace the sync trigger so org/recipient/message fields stay aligned.
drop trigger if exists notifications_sync_org_columns on public.notifications;
drop function if exists public.notifications_sync_org_columns();

create or replace function public.notifications_sync_columns()
returns trigger
language plpgsql
as $$
declare
  resolved_org uuid;
begin
  resolved_org := coalesce(new.organization_id, new.org_id);

  if new.organization_id is null and new.org_id is not null then
    new.organization_id := new.org_id;
  elsif new.org_id is null and new.organization_id is not null then
    new.org_id := new.organization_id;
  end if;

  if new.recipient_type is null then
    if new.user_id is not null then
      new.recipient_type := 'user';
    elsif resolved_org is not null then
      new.recipient_type := 'organization';
    end if;
  end if;

  if new.recipient_id is null then
    if new.recipient_type = 'user' then
      new.recipient_id := coalesce(new.user_id, new.recipient_id);
    elsif new.recipient_type = 'organization' then
      new.recipient_id := coalesce(resolved_org, new.recipient_id);
    end if;
  end if;

  if new.message is null and new.body is not null then
    new.message := new.body;
  elsif new.body is null and new.message is not null then
    new.body := new.message;
  end if;

  if new.status is null then
    new.status := case when coalesce(new.read, false) then 'read' else 'unread' end;
  end if;

  if new.status = 'read' and new.read_at is null then
    new.read_at := timezone('utc', now());
  elsif new.status = 'unread' then
    new.read_at := null;
  end if;

  if new.channel is null then
    if new.channels @> array['email','in_app'] then
      new.channel := 'both';
    elsif new.channels @> array['email'] then
      new.channel := 'email';
    else
      new.channel := 'in_app';
    end if;
  end if;

  if new.metadata is null then
    new.metadata := '{}'::jsonb;
  end if;

  return new;
end;
$$;

create trigger notifications_sync_columns
  before insert or update on public.notifications
  for each row execute function public.notifications_sync_columns();

-- 2) Email logs for outbound email tracking.
create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  recipient_type text default 'user' check (recipient_type in ('user','organization','contact','other')),
  recipient_id uuid,
  organization_id uuid references public.organizations(id) on delete set null,
  subject text not null,
  body text not null,
  sent_by uuid references auth.users(id) on delete set null,
  sent_at timestamptz not null default timezone('utc', now()),
  status text not null default 'queued' check (status in ('queued','sending','sent','failed')),
  provider_response jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists email_logs_recipient_idx on public.email_logs (recipient_email);
create index if not exists email_logs_recipient_id_idx on public.email_logs (recipient_id);
create index if not exists email_logs_org_idx on public.email_logs (organization_id);
create index if not exists email_logs_status_idx on public.email_logs (status);
create index if not exists email_logs_sent_at_idx on public.email_logs (sent_at desc);

drop trigger if exists email_logs_set_updated_at on public.email_logs;
create trigger email_logs_set_updated_at
  before update on public.email_logs
  for each row execute function public.set_updated_at();

alter table public.email_logs enable row level security;

drop policy if exists "email_logs_service_full_access" on public.email_logs;
create policy "email_logs_service_full_access"
  on public.email_logs
  for all
  to service_role
  using (true)
  with check (true);

-- 3) Message logs for future CRM activity history.
create table if not exists public.message_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  org_id uuid references public.organizations(id) on delete set null,
  recipient_type text not null default 'organization' check (recipient_type in ('organization','user')),
  recipient_id uuid,
  subject text,
  body text not null,
  channel text not null default 'in_app' check (channel in ('in_app','email','sms','push')),
  status text not null default 'draft' check (status in ('draft','queued','sending','sent','failed')),
  sent_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists message_logs_org_idx on public.message_logs (organization_id);
create index if not exists message_logs_recipient_idx on public.message_logs (recipient_type, recipient_id);
create index if not exists message_logs_status_idx on public.message_logs (status);
create index if not exists message_logs_sent_at_idx on public.message_logs (sent_at desc nulls last);

drop trigger if exists message_logs_set_updated_at on public.message_logs;
create trigger message_logs_set_updated_at
  before update on public.message_logs
  for each row execute function public.set_updated_at();

alter table public.message_logs enable row level security;

drop policy if exists "message_logs_service_full_access" on public.message_logs;
create policy "message_logs_service_full_access"
  on public.message_logs
  for all
  to service_role
  using (true)
  with check (true);
