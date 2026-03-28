-- Finalize the canonical org_invites / organization_memberships schema contract.
--
-- Why this exists:
-- 1. The app now prefers canonical organization_id columns.
-- 2. Older projects may still carry only legacy org_id values.
-- 3. PostgREST can keep a stale schema cache immediately after DDL unless we
--    explicitly request a reload.
--
-- This migration is intentionally idempotent and safe to run on already-fixed
-- databases.

-- ---------------------------------------------------------------------------
-- organization_memberships canonical column guard
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organization_memberships'
      and column_name = 'organization_id'
  ) then
    alter table public.organization_memberships
      add column organization_id uuid references public.organizations(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organization_memberships'
      and column_name = 'org_id'
  ) then
    begin
      execute $sql$
        update public.organization_memberships
        set organization_id = nullif(org_id::text, '')::uuid
        where organization_id is null
          and org_id is not null
      $sql$;
    exception when others then
      null;
    end;
  end if;
end $$;

create index if not exists organization_memberships_organization_id_idx
  on public.organization_memberships(organization_id)
  where organization_id is not null;

-- ---------------------------------------------------------------------------
-- org_invites canonical column guard
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'org_invites'
      and column_name = 'organization_id'
  ) then
    alter table public.org_invites
      add column organization_id uuid references public.organizations(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'org_invites'
      and column_name = 'org_id'
  ) then
    begin
      execute $sql$
        update public.org_invites
        set organization_id = nullif(org_id::text, '')::uuid
        where organization_id is null
          and org_id is not null
      $sql$;
    exception when others then
      null;
    end;
    begin
      execute $sql$
        update public.org_invites
        set org_id = organization_id::text
        where organization_id is not null
          and (org_id is null or org_id::text = '')
      $sql$;
    exception when others then
      null;
    end;
  end if;
end $$;

create index if not exists org_invites_organization_id_idx
  on public.org_invites(organization_id)
  where organization_id is not null;

create unique index if not exists org_invites_pending_unique_organization_id
  on public.org_invites(organization_id, lower(email))
  where organization_id is not null
    and status in ('pending', 'sent');

-- ---------------------------------------------------------------------------
-- Canonical invite view shape
-- ---------------------------------------------------------------------------
do $$
declare
  has_token boolean;
  has_invite_token boolean;
  token_expr text;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'org_invites'
      and column_name = 'token'
  ) into has_token;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'org_invites'
      and column_name = 'invite_token'
  ) into has_invite_token;

  if has_token and has_invite_token then
    token_expr := 'coalesce(i.token, i.invite_token)';
  elsif has_token then
    token_expr := 'i.token';
  elsif has_invite_token then
    token_expr := 'i.invite_token';
  else
    token_expr := 'null::text';
  end if;

  execute 'drop view if exists public.organization_invites';

  execute format($sql$
    create view public.organization_invites
      with (security_invoker = true)
    as
      select
        i.id,
        coalesce(i.organization_id, nullif(i.org_id::text, '''')::uuid) as organization_id,
        i.org_id,
        i.email,
        i.role,
        i.status,
        %s as token,
        coalesce(i.invited_by, i.inviter_id) as invited_by,
        coalesce(i.invited_at, i.created_at) as invited_at,
        i.accepted_at,
        i.accepted_user_id,
        i.expires_at,
        i.last_sent_at,
        i.reminder_count,
        i.duplicate_of,
        i.metadata,
        i.inviter_id,
        i.inviter_email,
        i.invited_name,
        i.note,
        i.created_at,
        i.updated_at
      from public.org_invites i
  $sql$, token_expr);
end $$;

-- ---------------------------------------------------------------------------
-- Ask PostgREST to refresh its schema cache after the DDL above.
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    perform pg_notify('pgrst', 'reload schema');
  exception when others then
    null;
  end;
end $$;
