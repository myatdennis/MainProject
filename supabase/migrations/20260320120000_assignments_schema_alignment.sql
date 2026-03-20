-- Align public.assignments with all columns written by the assignment route.
-- Previously org_id (stale) and user_id_uuid were referenced in server code
-- but only organization_id and user_id exist in the canonical schema, causing
-- PGRST204 "Could not find column" errors on every assignment write.

-- Add user_id_uuid as an alias/supplement to user_id for UUID-format user IDs.
-- The server writes both user_id (text) and user_id_uuid (text) for compatibility
-- with legacy rows that used either column.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'assignments'
      and column_name = 'user_id_uuid'
  ) then
    alter table public.assignments add column user_id_uuid text;
  end if;
end $$;

-- Backfill user_id_uuid from user_id where missing
update public.assignments
set user_id_uuid = user_id
where user_id_uuid is null and user_id is not null;

-- Add index to support the user_id_uuid lookup path
create index if not exists assignments_user_id_uuid_idx
  on public.assignments(user_id_uuid)
  where user_id_uuid is not null;

-- Ensure all columns added by earlier migrations are present (idempotent guard)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'assignments' and column_name = 'idempotency_key'
  ) then
    alter table public.assignments add column idempotency_key text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'assignments' and column_name = 'client_request_id'
  ) then
    alter table public.assignments add column client_request_id text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'assignments' and column_name = 'note'
  ) then
    alter table public.assignments add column note text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'assignments' and column_name = 'assigned_by'
  ) then
    alter table public.assignments add column assigned_by text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'assignments' and column_name = 'status'
  ) then
    alter table public.assignments
      add column status text not null default 'assigned';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'assignments' and column_name = 'progress'
  ) then
    alter table public.assignments
      add column progress integer not null default 0;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'assignments' and column_name = 'metadata'
  ) then
    alter table public.assignments add column metadata jsonb not null default '{}'::jsonb;
  end if;
end $$;

-- Add unique index for idempotency key deduplication
create unique index if not exists assignments_idempotency_key_idx
  on public.assignments(idempotency_key)
  where idempotency_key is not null;

create index if not exists assignments_client_request_id_idx
  on public.assignments(client_request_id)
  where client_request_id is not null;

comment on column public.assignments.user_id_uuid is
  'UUID-format copy of user_id. Maintained for dual-column lookup compatibility. Always equals user_id when set.';
comment on column public.assignments.idempotency_key is
  'Client-supplied idempotency key. Prevents duplicate assignment inserts on retry.';
comment on column public.assignments.client_request_id is
  'Client request correlation ID for tracing duplicate submissions.';
