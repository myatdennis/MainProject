create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Messages table supports admin-to-user/org communications
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id text primary key default gen_random_uuid()::text,
  sender_id text not null,
  recipient_user_id text,
  recipient_org_id text,
  subject text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'delivered',
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messages_recipient_check
    check ((recipient_user_id is not null) or (recipient_org_id is not null))
);

create index if not exists messages_sender_idx on public.messages(sender_id);
create index if not exists messages_recipient_user_idx on public.messages(recipient_user_id);
create index if not exists messages_recipient_org_idx on public.messages(recipient_org_id);

alter table public.messages
  drop constraint if exists messages_recipient_org_fk,
  drop constraint if exists messages_recipient_user_fk;

-- Optional foreign key to notifications will be established via message_id references

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'messages_set_updated_at') then
    create trigger messages_set_updated_at
      before update on public.messages
      for each row execute function public.set_updated_at();
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- Expand notifications table with typed payloads + linkage to messages
-- ---------------------------------------------------------------------------
alter table public.notifications
  add column if not exists type text not null default 'generic',
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists message_id text,
  add column if not exists read_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.notifications
  alter column user_id drop default,
  alter column user_id type text using user_id::text,
  alter column org_id type text using org_id::text,
  alter column title set default '',
  alter column body set default '';

-- Rename deprecated read flag to is_read to align with API naming
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
      AND column_name = 'read'
  ) THEN
    ALTER TABLE public.notifications RENAME COLUMN read TO is_read;
  END IF;
END$$;

alter table public.notifications
  alter column is_read set default false,
  alter column is_read set not null;

alter table public.notifications
  add constraint notifications_message_fk foreign key (message_id) references public.messages(id) on delete cascade;

create index if not exists notifications_user_unread_idx on public.notifications(user_id, is_read);
create index if not exists notifications_org_idx on public.notifications(org_id);
create index if not exists notifications_type_idx on public.notifications(type);

-- Ensure updated_at trigger exists for notifications as schema evolves
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'notifications_set_updated_at') then
    create trigger notifications_set_updated_at
      before update on public.notifications
      for each row execute function public.set_updated_at();
  end if;
end$$;
