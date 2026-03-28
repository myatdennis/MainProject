-- Align canonical organization_id columns with the runtime contract.
--
-- The app now treats:
--   public.organization_memberships.organization_id
--   public.org_invites.organization_id
-- as the canonical foreign keys to organizations.
--
-- Older migrations created only org_id. Production has already been partially
-- normalized, but a clean project rebuild from migrations could still drift.
--
-- This migration adds the canonical columns, backfills them, keeps legacy org_id
-- in sync for older policies/views, and adds indexes/constraints on the
-- canonical columns without dropping the compatibility columns.

-- ---------------------------------------------------------------------------
-- organization_memberships
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

    begin
      execute $sql$
        update public.organization_memberships
        set org_id = organization_id::text
        where organization_id is not null
          and (org_id is null or org_id::text = '')
      $sql$;
    exception when others then
      null;
    end;
  end if;
end $$;

create or replace function public.sync_membership_org_columns()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null and new.org_id is not null then
    begin
      new.organization_id := nullif(new.org_id::text, '')::uuid;
    exception when others then
      null;
    end;
  end if;

  if new.org_id is null and new.organization_id is not null then
    new.org_id := new.organization_id::text;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_membership_org_columns on public.organization_memberships;
create trigger trg_sync_membership_org_columns
  before insert or update on public.organization_memberships
  for each row execute function public.sync_membership_org_columns();

create index if not exists organization_memberships_organization_id_idx
  on public.organization_memberships(organization_id);

create unique index if not exists organization_memberships_unique_organization_id_user_id
  on public.organization_memberships(organization_id, user_id)
  where organization_id is not null;

-- ---------------------------------------------------------------------------
-- org_invites
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

create or replace function public.sync_org_invites_org_columns()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null and new.org_id is not null then
    begin
      new.organization_id := nullif(new.org_id::text, '')::uuid;
    exception when others then
      null;
    end;
  end if;

  if new.org_id is null and new.organization_id is not null then
    new.org_id := new.organization_id::text;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_org_invites_org_columns on public.org_invites;
create trigger trg_sync_org_invites_org_columns
  before insert or update on public.org_invites
  for each row execute function public.sync_org_invites_org_columns();

create index if not exists org_invites_organization_id_idx
  on public.org_invites(organization_id);

create unique index if not exists org_invites_pending_unique_organization_id
  on public.org_invites(organization_id, lower(email))
  where organization_id is not null
    and status in ('pending', 'sent');
