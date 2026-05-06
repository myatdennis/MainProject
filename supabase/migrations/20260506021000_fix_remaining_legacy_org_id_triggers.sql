-- Launch write-path fix: remaining triggers on canonical org schemas still
-- referenced legacy org_id columns that no longer exist in production.

begin;

create or replace function public.sync_org_membership_compat_cols()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.profile_id := coalesce(new.profile_id, new.user_id);
  return new;
end;
$$;

create or replace function public.org_invites_integrity_trigger_impl()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
begin
  if new.organization_id is null then
    raise exception 'organization_id cannot be null for org_invites';
  end if;

  if new.status in ('pending', 'sent') then
    if new.expires_at is null then
      raise exception 'expires_at cannot be null for org_invites';
    end if;
    if new.expires_at <= now() then
      raise exception 'expires_at must be in the future';
    end if;

    if new.inviter_id is not null then
      if not public.can_invite_to_org(new.inviter_id, new.organization_id) then
        raise exception 'inviter_id (%) is not authorized to invite in org %', new.inviter_id, new.organization_id;
      end if;
    end if;

    if new.created_by is not null then
      if not public.can_invite_to_org(new.created_by, new.organization_id) then
        raise exception 'created_by (%) is not authorized to create in org %', new.created_by, new.organization_id;
      end if;
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if old.organization_id is distinct from new.organization_id then
      raise exception 'organization_id cannot be changed once set';
    end if;
  end if;

  if new.created_by is null and new.inviter_id is not null then
    new.created_by := new.inviter_id;
  end if;

  return new;
end;
$$;

commit;
