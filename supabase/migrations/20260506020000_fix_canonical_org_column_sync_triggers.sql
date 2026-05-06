-- Launch write-path fix: production no longer has legacy org_id columns on
-- organization_memberships/org_invites. Older sync triggers referenced
-- NEW.org_id and crashed writes after the column was removed.

begin;

create or replace function public.sync_membership_org_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  return new;
end;
$$;

create or replace function public.sync_org_invites_org_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  return new;
end;
$$;

drop index if exists public.organization_memberships_unique;

commit;
